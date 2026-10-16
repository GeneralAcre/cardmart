import "server-only";

import type { CardGame } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { marketCardKey } from "@/lib/market-history";
import { tierKey } from "@/lib/grade-tier";
import { THB_PER_USD } from "@/lib/pricing";
import { buildIndex, changeOver, changeWithin, type PricePoint } from "@/lib/stats-math";
import type { HoldingPnl } from "@/lib/pnl";

// Market-wide and portfolio statistics, all from the daily eBay market prices
// saved in MarketPriceSnapshot. Nothing is estimated: a card counts only from
// the first day it has a saved price.

export type IndexKey = "ALL" | CardGame;

export interface MarketIndex {
  key: IndexKey;
  points: PricePoint[];
  change7d: number | null;
  change30d: number | null;
  /** Over the last 30 days, or since the index began when it's younger. */
  change30dOrSince: number | null;
  /** How many card-and-grade price series the index is built from. */
  constituents: number;
}

type CardLike = {
  name: string;
  subtitle: string;
  cardNumber: string | null;
  language: "ENGLISH" | "JAPANESE" | null;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
};

const seriesKey = (card: CardLike) => `${marketCardKey(card)}#${tierKey(card)}`;

/** Every saved daily market price for these cards, as THB series by card-and-grade key. */
async function priceSeries(cards: CardLike[]): Promise<Map<string, PricePoint[]>> {
  const cardKeys = [...new Set(cards.map((c) => marketCardKey(c)))];
  if (cardKeys.length === 0) return new Map();
  const rows = await prisma.marketPriceSnapshot.findMany({
    where: { cardKey: { in: cardKeys } },
    orderBy: { day: "asc" },
    select: { cardKey: true, tierKey: true, day: true, medianUsd: true },
  });
  const series = new Map<string, PricePoint[]>();
  for (const r of rows) {
    const key = `${r.cardKey}#${r.tierKey}`;
    if (!series.has(key)) series.set(key, []);
    series.get(key)!.push({ t: r.day.getTime(), price: Math.round(r.medianUsd * THB_PER_USD) });
  }
  return series;
}

/**
 * The CardMart indexes: every card and grade on CardMart that has a saved
 * market price, equal-weighted (see buildIndex), for all games and per game.
 */
export async function getMarketIndexes(): Promise<MarketIndex[]> {
  const assets = await prisma.asset.findMany({
    where: { redeemedAt: null },
    select: {
      game: true,
      name: true,
      subtitle: true,
      cardNumber: true,
      language: true,
      gradingCompany: true,
      grade: true,
      isBlackLabel: true,
    },
  });
  const series = await priceSeries(assets);
  const keysByGame = new Map<IndexKey, Set<string>>([["ALL", new Set()]]);
  for (const a of assets) {
    const key = seriesKey(a);
    if (!series.has(key)) continue;
    keysByGame.get("ALL")!.add(key);
    if (!keysByGame.has(a.game)) keysByGame.set(a.game, new Set());
    keysByGame.get(a.game)!.add(key);
  }

  const order: IndexKey[] = ["ALL", "POKEMON", "ONE_PIECE"];
  return order.map((key) => {
    const keys = [...(keysByGame.get(key) ?? [])];
    const points = buildIndex(keys.map((k) => series.get(k)!));
    return {
      key,
      points,
      change7d: changeOver(points, 7),
      change30d: changeOver(points, 30),
      change30dOrSince: changeWithin(points, 30),
      constituents: keys.length,
    };
  });
}

export interface PortfolioStats {
  /** Sum of market prices of the held cards that have one. */
  marketValueThb: number;
  pricedCount: number;
  heldCount: number;
  /** Profit or loss across held cards with both a cost and a market price. */
  unrealizedThb: number | null;
  unrealizedPct: number | null;
  /** The held cards' combined market value change over 30 days. */
  change30d: number | null;
  /** The all-games index over the same 30 days, to compare against. */
  index30d: number | null;
  best: { assetId: string; name: string; gainPct: number } | null;
  worst: { assetId: string; name: string; gainPct: number } | null;
  byGame: { key: CardGame; count: number; valueThb: number }[];
  byGrade: { key: string; count: number; valueThb: number }[];
}

type HeldCard = CardLike & { id: string; game: CardGame };

/** Grade buckets for the portfolio breakdown. */
function gradeBucket(card: CardLike): string {
  if (card.gradingCompany === "RAW" || card.grade == null) return "Ungraded";
  if (card.isBlackLabel) return "Black Label";
  if (card.grade >= 10) return "Grade 10";
  if (card.grade >= 9) return "Grade 9";
  return "Grade 8 and below";
}

/** Totals, best and worst card, 30-day change against the index, and breakdowns. */
export async function getPortfolioStats(
  assets: HeldCard[],
  pnl: Record<string, HoldingPnl>,
  index30d: number | null,
): Promise<PortfolioStats> {
  const series = await priceSeries(assets);

  let marketValueThb = 0;
  let pricedCount = 0;
  let gain = 0;
  let cost = 0;
  let nowSum = 0;
  let thenSum = 0;
  const DAY = 86_400_000;
  const byGame = new Map<CardGame, { count: number; valueThb: number }>();
  const byGrade = new Map<string, { count: number; valueThb: number }>();
  const ranked: { assetId: string; name: string; gainPct: number }[] = [];

  for (const a of assets) {
    const p = pnl[a.id];
    const value = p?.valueThb ?? null;
    if (value != null) {
      marketValueThb += value;
      pricedCount += 1;
    }
    if (p?.gainThb != null && p.costThb != null) {
      gain += p.gainThb;
      cost += p.costThb;
    }
    if (p?.gainPct != null) ranked.push({ assetId: a.id, name: a.name, gainPct: p.gainPct });

    // 30-day move: this card's market price now against 30 days ago (or its
    // first saved day, when it has been tracked for less than that).
    const points = series.get(seriesKey(a));
    const last = points?.at(-1);
    if (points && last && points.length >= 2) {
      const cutoff = last.t - 30 * DAY;
      const then = [...points].reverse().find((pt) => pt.t <= cutoff) ?? points[0];
      if (then.t < last.t) {
        nowSum += last.price;
        thenSum += then.price;
      }
    }

    const g = byGame.get(a.game) ?? { count: 0, valueThb: 0 };
    byGame.set(a.game, { count: g.count + 1, valueThb: g.valueThb + (value ?? 0) });
    const bucket = gradeBucket(a);
    const b = byGrade.get(bucket) ?? { count: 0, valueThb: 0 };
    byGrade.set(bucket, { count: b.count + 1, valueThb: b.valueThb + (value ?? 0) });
  }

  ranked.sort((x, y) => y.gainPct - x.gainPct);
  const gradeOrder = ["Black Label", "Grade 10", "Grade 9", "Grade 8 and below", "Ungraded"];
  return {
    marketValueThb,
    pricedCount,
    heldCount: assets.length,
    unrealizedThb: cost > 0 ? gain : null,
    unrealizedPct: cost > 0 ? (gain / cost) * 100 : null,
    change30d: thenSum > 0 ? ((nowSum - thenSum) / thenSum) * 100 : null,
    index30d,
    best: ranked.length > 0 ? ranked[0] : null,
    worst: ranked.length > 1 ? ranked.at(-1)! : null,
    byGame: [...byGame.entries()].map(([key, v]) => ({ key, ...v })),
    byGrade: gradeOrder.filter((k) => byGrade.has(k)).map((key) => ({ key, ...byGrade.get(key)! })),
  };
}
