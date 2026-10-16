import "server-only";

import type { CardGame } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { marketCardKey } from "@/lib/market-history";
import { tierKey } from "@/lib/grade-tier";
import { THB_PER_USD } from "@/lib/pricing";
import { buildIndex, changeOver, changeWithin, type PricePoint } from "@/lib/stats-math";
import { displayImage } from "@/lib/card-image";
import { INDEX_BASKETS } from "@/lib/index-baskets";
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

/** One card-and-grade inside an index, with its own price series. */
export interface IndexMember {
  key: string;
  name: string;
  subtitle: string;
  cardNumber: string | null;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  /** A CardMart listing of this card to link to and borrow a picture from, when one exists. */
  assetId: string | null;
  photoUrl: string | null;
  points: PricePoint[];
  latestThb: number;
  change7d: number | null;
  change30dOrSince: number | null;
}

export const INDEX_KEYS: IndexKey[] = ["ALL", "POKEMON", "ONE_PIECE"];

/**
 * Who's in each index. The CardMart Index is every card and grade on CardMart
 * with a saved market price. The Pokémon and One Piece indexes are fixed lists
 * of well-known cards priced from eBay (lib/index-baskets.ts), whether or not
 * they're on CardMart. A card counts only once it has a saved price.
 */
async function loadIndexMembers(): Promise<Record<IndexKey, IndexMember[]>> {
  const assets = await prisma.asset.findMany({
    where: { redeemedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      game: true,
      name: true,
      subtitle: true,
      cardNumber: true,
      language: true,
      gradingCompany: true,
      grade: true,
      isBlackLabel: true,
      catalogImageUrl: true,
      verificationPhotos: { orderBy: { createdAt: "asc" }, take: 1, select: { url: true } },
    },
  });
  const series = await priceSeries([...assets, ...INDEX_BASKETS]);
  // A CardMart listing per card (any grade), for a link and a picture.
  const assetByCard = new Map<string, (typeof assets)[number]>();
  const assetBySeries = new Map<string, (typeof assets)[number]>();
  for (const a of assets) {
    if (!assetByCard.has(marketCardKey(a))) assetByCard.set(marketCardKey(a), a);
    if (!assetBySeries.has(seriesKey(a))) assetBySeries.set(seriesKey(a), a);
  }

  const member = (card: CardLike, key: string): IndexMember => {
    const points = series.get(key)!;
    const asset = assetBySeries.get(key) ?? assetByCard.get(marketCardKey(card)) ?? null;
    return {
      key,
      name: card.name,
      subtitle: card.subtitle,
      cardNumber: card.cardNumber,
      gradingCompany: card.gradingCompany,
      grade: card.grade,
      isBlackLabel: card.isBlackLabel,
      assetId: asset?.id ?? null,
      photoUrl: asset ? (displayImage(asset)?.url ?? null) : null,
      points,
      latestThb: points.at(-1)!.price,
      change7d: changeOver(points, 7),
      change30dOrSince: changeWithin(points, 30),
    };
  };

  const result: Record<IndexKey, IndexMember[]> = { ALL: [], POKEMON: [], ONE_PIECE: [] };
  const seen = new Set<string>();
  for (const a of assets) {
    const key = seriesKey(a);
    if (seen.has(key) || !series.has(key)) continue;
    seen.add(key);
    result.ALL.push(member(a, key));
  }
  for (const card of INDEX_BASKETS) {
    const key = seriesKey(card);
    if (series.has(key)) result[card.game].push(member(card, key));
  }
  return result;
}

function summarize(key: IndexKey, members: IndexMember[]): MarketIndex {
  const points = buildIndex(members.map((m) => m.points));
  return {
    key,
    points,
    change7d: changeOver(points, 7),
    change30d: changeOver(points, 30),
    change30dOrSince: changeWithin(points, 30),
    constituents: members.length,
  };
}

/** The three indexes, each equal-weighted and chain-linked from daily prices (see buildIndex). */
export async function getMarketIndexes(): Promise<MarketIndex[]> {
  const members = await loadIndexMembers();
  return INDEX_KEYS.map((key) => summarize(key, members[key]));
}

/** One index with every card inside it, best performer first. */
export async function getIndexDetail(key: IndexKey): Promise<{ index: MarketIndex; members: IndexMember[] }> {
  const members = (await loadIndexMembers())[key];
  const rank = (m: IndexMember) => m.change30dOrSince ?? -Infinity;
  return { index: summarize(key, members), members: [...members].sort((x, y) => rank(y) - rank(x)) };
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
