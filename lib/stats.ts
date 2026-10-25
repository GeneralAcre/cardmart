import "server-only";

import type { CardGame } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { marketCardKey } from "@/lib/market-history";
import { tierKey } from "@/lib/grade-tier";
import { THB_PER_USD } from "@/lib/pricing";
import { buildIndex, buildMembershipIndex, changeOver, changeSincePrevious, changeWithin, type PricePoint } from "@/lib/stats-math";
import { WAREHOUSE_FIRST, displayImage } from "@/lib/card-image";
import { TOP_N } from "@/lib/top-index";
import type { HoldingPnl } from "@/lib/pnl";
import { formatGrade } from "@/lib/format";

// Market-wide and portfolio statistics, all from the daily eBay market prices
// saved in MarketPriceSnapshot. Nothing is estimated: a card counts only from
// the first day it has a saved price.

export type IndexKey = "ALL" | CardGame;

export interface MarketIndex {
  key: IndexKey;
  points: PricePoint[];
  /** Since the previous saved day. */
  change1d: number | null;
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

/** One card inside an index, with its own price series. */
export interface IndexMember {
  key: string;
  name: string;
  subtitle: string;
  cardNumber: string | null;
  /** Printed rarity ("Secret Rare", "SEC"…) when the source gives one. */
  rarity: string | null;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  /** A CardMart listing of this card to link to, when the index is built from CardMart's own cards. */
  assetId: string | null;
  /** Where to read more about the card when it isn't a CardMart listing. */
  externalUrl: string | null;
  photoUrl: string | null;
  points: PricePoint[];
  latestThb: number;
  change1d: number | null;
  change7d: number | null;
  change30dOrSince: number | null;
}

export const INDEX_KEYS: IndexKey[] = ["ALL", "POKEMON", "ONE_PIECE"];

const memberChanges = (points: PricePoint[]) => ({
  latestThb: points.at(-1)!.price,
  change1d: changeSincePrevious(points),
  change7d: changeOver(points, 7),
  change30dOrSince: changeWithin(points, 30),
});

/**
 * The CardMart Index: every card and grade on CardMart with a saved market
 * price (eBay's daily median asking price for that card in that grade).
 */
async function loadCardMartMembers(): Promise<IndexMember[]> {
  const assets = await prisma.asset.findMany({
    where: { redeemedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      subtitle: true,
      cardNumber: true,
      language: true,
      gradingCompany: true,
      grade: true,
      isBlackLabel: true,
      rarity: true,
      catalogImageUrl: true,
      verificationPhotos: { orderBy: WAREHOUSE_FIRST, take: 1, select: { url: true } },
    },
  });
  const series = await priceSeries(assets);
  const members: IndexMember[] = [];
  const seen = new Set<string>();
  for (const a of assets) {
    const key = seriesKey(a);
    if (seen.has(key) || !series.has(key)) continue;
    seen.add(key);
    const points = series.get(key)!;
    members.push({
      key,
      name: a.name,
      subtitle: a.subtitle,
      cardNumber: a.cardNumber,
      rarity: a.rarity,
      gradingCompany: a.gradingCompany,
      grade: a.grade,
      isBlackLabel: a.isBlackLabel,
      assetId: a.id,
      externalUrl: null,
      photoUrl: displayImage(a)?.url ?? null,
      points,
      ...memberChanges(points),
    });
  }
  return members;
}

interface TopIndex {
  members: IndexMember[];
  points: PricePoint[];
}

// The ranking only changes once a day, so a short in-memory copy spares the
// database a read of the whole history on every page view.
const TOP_CACHE_MS = 10 * 60_000;
const topCache = new Map<CardGame, { at: number; value: TopIndex }>();

/**
 * A game's index: the TOP_N most valuable cards by TCGplayer market price
 * (lib/top-index.ts saves the ranking every day). Its level is built from
 * the cards held each day, so a card counts only while it's in the top 50.
 */
async function loadTopIndex(game: CardGame): Promise<TopIndex> {
  const cached = topCache.get(game);
  if (cached && Date.now() - cached.at < TOP_CACHE_MS) return cached.value;

  const rows = await prisma.indexPrice.findMany({
    where: { game },
    orderBy: [{ day: "asc" }, { rank: "asc" }],
  });
  const toThb = (usd: number) => Math.round(usd * THB_PER_USD);
  let value: TopIndex = { members: [], points: [] };
  if (rows.length > 0) {
    const points = buildMembershipIndex(
      rows.map((r) => ({ t: r.day.getTime(), productId: r.productId, rank: r.rank, price: toThb(r.priceUsd) })),
      TOP_N,
    );
    const byProduct = new Map<number, PricePoint[]>();
    for (const r of rows) {
      if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
      byProduct.get(r.productId)!.push({ t: r.day.getTime(), price: toThb(r.priceUsd) });
    }
    const latest = rows[rows.length - 1].day.getTime();
    const members: IndexMember[] = rows
      .filter((r) => r.day.getTime() === latest && r.rank <= TOP_N)
      .map((r) => {
        const series = byProduct.get(r.productId)!;
        return {
          key: `top:${game}:${r.productId}`,
          name: r.name,
          subtitle: r.setName,
          cardNumber: r.cardNumber,
          rarity: r.rarity,
          gradingCompany: "RAW",
          grade: null,
          isBlackLabel: false,
          assetId: null,
          externalUrl: `https://www.tcgplayer.com/product/${r.productId}`,
          photoUrl: r.imageUrl,
          points: series,
          ...memberChanges(series),
        };
      });
    value = { members, points };
  }
  topCache.set(game, { at: Date.now(), value });
  return value;
}

function summarize(key: IndexKey, members: IndexMember[], points: PricePoint[]): MarketIndex {
  return {
    key,
    points,
    change1d: changeSincePrevious(points),
    change7d: changeOver(points, 7),
    change30d: changeOver(points, 30),
    change30dOrSince: changeWithin(points, 30),
    constituents: members.length,
  };
}

async function loadEverything() {
  const [cardmart, pokemon, onePiece] = await Promise.all([
    loadCardMartMembers(),
    loadTopIndex("POKEMON"),
    loadTopIndex("ONE_PIECE"),
  ]);
  const byKey: Record<IndexKey, { members: IndexMember[]; points: PricePoint[] }> = {
    ALL: { members: cardmart, points: buildIndex(cardmart.map((m) => m.points)) },
    POKEMON: pokemon,
    ONE_PIECE: onePiece,
  };
  return byKey;
}

/** One game's index line, for a card page's "vs index" comparison. */
export async function getGameIndexPoints(game: CardGame): Promise<PricePoint[]> {
  return (await loadTopIndex(game)).points;
}

/** The three indexes. */
export async function getMarketIndexes(): Promise<MarketIndex[]> {
  const byKey = await loadEverything();
  return INDEX_KEYS.map((key) => summarize(key, byKey[key].members, byKey[key].points));
}

/** One index with every card inside it (best performer first), plus all three indexes for "other indexes". */
export async function getIndexDetail(
  key: IndexKey,
): Promise<{ index: MarketIndex; members: IndexMember[]; all: MarketIndex[] }> {
  const byKey = await loadEverything();
  const rank = (m: IndexMember) => m.change30dOrSince ?? -Infinity;
  return {
    index: summarize(key, byKey[key].members, byKey[key].points),
    members: [...byKey[key].members].sort((x, y) => rank(y) - rank(x)),
    all: INDEX_KEYS.map((k) => summarize(k, byKey[k].members, byKey[k].points)),
  };
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

/** One bucket per grade: Black Label, then every score on its own (10, 9.5, 9, 8.5, …), then ungraded. */
function gradeBucket(card: CardLike): string {
  if (card.gradingCompany === "RAW" || card.grade == null) return "Ungraded";
  if (card.isBlackLabel) return "Black Label";
  return `Grade ${formatGrade(card.grade)}`;
}

/** Black Label first, the scores from highest to lowest, ungraded last. */
function gradeBucketRank(key: string): number {
  if (key === "Black Label") return Infinity;
  if (key === "Ungraded") return -Infinity;
  return Number(key.replace("Grade ", ""));
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
    byGrade: [...byGrade.entries()]
      .sort(([a], [b]) => gradeBucketRank(b) - gradeBucketRank(a))
      .map(([key, v]) => ({ key, ...v })),
  };
}
