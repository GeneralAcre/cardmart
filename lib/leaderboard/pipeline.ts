import "server-only";

import type { AntiCheatAction, AntiCheatRule, LeaderboardCategory, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { marketCardKey } from "@/lib/market-history";
import { tierKey } from "@/lib/grade-tier";
import { THB_PER_USD } from "@/lib/pricing";
import { currentWindow, previousWindow, PERIODS, type Window } from "@/lib/leaderboard/periods";

// The trader leaderboard pipeline. Every board is rebuilt from completed
// CardMart sales (EscrowTransaction RELEASED), so it can be rerun at any time
// and always agrees with the sales history. Steps:
//
//   1. Load every completed sale with its card, both parties and wallets.
//   2. Guardrails: flag self-trades, linked wallets, round trips, sub-minute
//      flips and off-market prices, and log each flag (AntiCheatLog).
//   3. Cost basis: a sale's cost is the seller's own earlier CardMart purchase
//      of that card plus the buyer-protection fee they paid on it. Prices users
//      type in themselves (PurchaseCost) never count, so they can't be gamed.
//   4. For each window, work out every trader's figures and rank each board.
//   5. Replace the stored boards and stats; award badges for closed periods.

const MIN_ROI_TRADES = 5;
const MIN_CONSISTENCY_TRADES = 10;
const MIN_WIN_RATE = 48;
const MIN_COUNTERPARTIES = 2;
const SHORT_HOLD_MS = 60_000;
const ROUND_TRIP_MS = 7 * 86_400_000;
const OUTLIER_RATIO = 0.5;
/** Ranks stored per board; enough for any page and for "your rank". */
const MAX_RANKS = 1000;

type Flag = { rule: AntiCheatRule; action: AntiCheatAction; detail: string };

interface Sale {
  id: string;
  assetId: string;
  buyerId: string;
  sellerId: string;
  amountThb: number;
  serviceFeeThb: number;
  lockedAt: Date;
  releasedAt: Date;
  payerWallet: string | null;
  game: string;
  gradingCompany: string;
  marketKey: string;
}

interface ClosedTrade {
  sale: Sale;
  costThb: number;
  profitThb: number;
  roiPct: number;
}

export interface TraderStats {
  userId: string;
  qualifyingTrades: number;
  winningTrades: number;
  realizedProfitThb: number;
  costBasisThb: number;
  roiPct: number | null;
  bestTradeRoiPct: number | null;
  winRatePct: number | null;
  greenDayStreak: number;
  volumeThb: number;
  filledOrders: number;
  distinctCounterparties: number;
  excludedTrades: number;
  /** Realized profit and trade count per specialist segment ("GAME:POKEMON", "GRADER:PSA"). */
  segments: Record<string, { profitThb: number; volumeThb: number; trades: number }>;
}

export interface BoardRow {
  userId: string;
  rank: number;
  score: number;
  metrics: Prisma.InputJsonObject;
}

export interface Board {
  category: LeaderboardCategory;
  segment: string;
  rows: BoardRow[];
}

/** Steps 1–3: sales, guardrail flags, and which sales count for what. */
async function loadContext() {
  const [rawSales, users, agentWallets, cleared] = await Promise.all([
    prisma.escrowTransaction.findMany({
      where: { status: "RELEASED", releasedAt: { not: null } },
      orderBy: { releasedAt: "asc" },
      select: {
        id: true,
        assetId: true,
        buyerId: true,
        sellerId: true,
        amountThb: true,
        serviceFeeThb: true,
        createdAt: true,
        releasedAt: true,
        payerWalletAddress: true,
        asset: {
          select: {
            name: true,
            subtitle: true,
            cardNumber: true,
            language: true,
            game: true,
            gradingCompany: true,
            grade: true,
            isBlackLabel: true,
          },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, walletAddress: true, walletMock: true, isBanned: true } }),
    prisma.agentWallet.findMany({ select: { address: true, userId: true } }),
    prisma.antiCheatLog.findMany({ where: { cleared: true }, select: { escrowTransactionId: true, rule: true } }),
  ]);

  const sales: Sale[] = rawSales.map((s) => ({
    id: s.id,
    assetId: s.assetId,
    buyerId: s.buyerId,
    sellerId: s.sellerId,
    amountThb: s.amountThb,
    serviceFeeThb: s.serviceFeeThb,
    lockedAt: s.createdAt,
    releasedAt: s.releasedAt!,
    payerWallet: s.payerWalletAddress,
    game: s.asset.game,
    gradingCompany: s.asset.gradingCompany,
    marketKey: `${marketCardKey(s.asset)}#${tierKey(s.asset)}`,
  }));

  // Wallet → owner, including buying-agent wallets.
  const walletOwner = new Map<string, string>();
  const walletsByUser = new Map<string, Set<string>>();
  const addWallet = (address: string | null, userId: string) => {
    if (!address) return;
    walletOwner.set(address, userId);
    if (!walletsByUser.has(userId)) walletsByUser.set(userId, new Set());
    walletsByUser.get(userId)!.add(address);
  };
  for (const u of users) {
    addWallet(u.walletAddress, u.id);
    addWallet(u.walletMock, u.id);
  }
  for (const w of agentWallets) addWallet(w.address, w.userId);
  const banned = new Set(users.filter((u) => u.isBanned).map((u) => u.id));

  // Market reference for the outlier check: the saved daily eBay median for
  // the same card and grade on or before the sale day.
  const marketRows = await prisma.marketPriceSnapshot.findMany({
    where: { cardKey: { in: [...new Set(rawSales.map((s) => marketCardKey(s.asset)))] } },
    orderBy: { day: "asc" },
    select: { cardKey: true, tierKey: true, day: true, medianUsd: true },
  });
  const market = new Map<string, { t: number; thb: number }[]>();
  for (const r of marketRows) {
    const key = `${r.cardKey}#${r.tierKey}`;
    if (!market.has(key)) market.set(key, []);
    market.get(key)!.push({ t: r.day.getTime(), thb: Math.round(r.medianUsd * THB_PER_USD) });
  }
  const marketAt = (key: string, at: Date) => {
    let found: number | null = null;
    for (const p of market.get(key) ?? []) {
      if (p.t > at.getTime()) break;
      found = p.thb;
    }
    return found;
  };

  // Cost basis: the seller's own most recent earlier purchase of the card.
  const purchasesByAsset = new Map<string, Sale[]>();
  for (const s of sales) {
    if (!purchasesByAsset.has(s.assetId)) purchasesByAsset.set(s.assetId, []);
    purchasesByAsset.get(s.assetId)!.push(s);
  }
  const acquisitionOf = (sale: Sale) =>
    (purchasesByAsset.get(sale.assetId) ?? [])
      .filter((p) => p.buyerId === sale.sellerId && p.releasedAt.getTime() < sale.releasedAt.getTime())
      .at(-1) ?? null;

  // Guardrails.
  const flags = new Map<string, Flag[]>();
  const flag = (saleId: string, f: Flag) => {
    if (!flags.has(saleId)) flags.set(saleId, []);
    flags.get(saleId)!.push(f);
  };
  for (const s of sales) {
    if (s.buyerId === s.sellerId) {
      flag(s.id, { rule: "SELF_TRADE", action: "EXCLUDED", detail: "Buyer and seller are the same account." });
    }
    const payerOwner = s.payerWallet ? walletOwner.get(s.payerWallet) : undefined;
    const sellerWallets = walletsByUser.get(s.sellerId) ?? new Set<string>();
    const buyerWallets = walletsByUser.get(s.buyerId) ?? new Set<string>();
    const shared = [...buyerWallets].some((w) => sellerWallets.has(w));
    if ((payerOwner && payerOwner === s.sellerId && s.buyerId !== s.sellerId) || shared) {
      flag(s.id, {
        rule: "LINKED_WALLET",
        action: "EXCLUDED",
        detail: shared ? "Buyer and seller share a wallet." : "The buyer paid from a wallet that belongs to the seller.",
      });
    }
    const acquired = acquisitionOf(s);
    if (acquired && s.lockedAt.getTime() - acquired.releasedAt.getTime() < SHORT_HOLD_MS) {
      flag(s.id, { rule: "SHORT_HOLD", action: "REVIEW", detail: "Sold less than 60 seconds after buying it." });
    }
    const reference = marketAt(s.marketKey, s.releasedAt);
    if (reference && Math.abs(s.amountThb - reference) / reference > OUTLIER_RATIO) {
      flag(s.id, {
        rule: "OUTLIER_PRICE",
        action: "REVIEW",
        detail: `Sold for ${s.amountThb.toLocaleString()} THB against a market price of ${reference.toLocaleString()} THB.`,
      });
    }
  }
  // Round trips: A sells to B, then B sells the same card back to A within 7 days.
  for (const list of purchasesByAsset.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [x, y] = [list[i], list[j]];
        if (y.releasedAt.getTime() - x.releasedAt.getTime() > ROUND_TRIP_MS) break;
        if (x.sellerId === y.buyerId && x.buyerId === y.sellerId && x.sellerId !== x.buyerId) {
          const detail = "The card went back to the account that sold it within 7 days.";
          flag(x.id, { rule: "ROUND_TRIP", action: "EXCLUDED", detail });
          flag(y.id, { rule: "ROUND_TRIP", action: "EXCLUDED", detail });
        }
      }
    }
  }

  // Staff can clear a flag; a cleared flag no longer counts against the sale.
  const clearedKeys = new Set(cleared.map((c) => `${c.escrowTransactionId}:${c.rule}`));
  const activeFlags = (saleId: string) => (flags.get(saleId) ?? []).filter((f) => !clearedKeys.has(`${saleId}:${f.rule}`));
  const VOLUME_RULES: AntiCheatRule[] = ["SELF_TRADE", "LINKED_WALLET", "ROUND_TRIP"];
  const countsForProfit = (s: Sale) => activeFlags(s.id).length === 0;
  const countsForVolume = (s: Sale) => !activeFlags(s.id).some((f) => VOLUME_RULES.includes(f.rule));

  const closed: ClosedTrade[] = [];
  for (const s of sales) {
    if (!countsForProfit(s) || banned.has(s.sellerId)) continue;
    const acquired = acquisitionOf(s);
    if (!acquired) continue; // no CardMart-verified cost
    const costThb = acquired.amountThb + acquired.serviceFeeThb;
    if (costThb <= 0) continue;
    const profitThb = s.amountThb - costThb;
    closed.push({ sale: s, costThb, profitThb, roiPct: (profitThb / costThb) * 100 });
  }

  return { sales, flags, closed, banned, countsForVolume, activeFlags };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

// Half-open [from, to), so a sale on a week boundary belongs to exactly one week.
const inWindow = (at: Date, w: Window) => at.getTime() >= w.from.getTime() && at.getTime() < w.to.getTime();

/** Step 4a: every trader's figures for one window. */
function computeStats(ctx: Context, w: Window): Map<string, TraderStats> {
  const stats = new Map<string, TraderStats>();
  const counterparties = new Map<string, Set<string>>();
  const days = new Map<string, Map<string, number>>();
  const get = (userId: string) => {
    if (!stats.has(userId)) {
      stats.set(userId, {
        userId,
        qualifyingTrades: 0,
        winningTrades: 0,
        realizedProfitThb: 0,
        costBasisThb: 0,
        roiPct: null,
        bestTradeRoiPct: null,
        winRatePct: null,
        greenDayStreak: 0,
        volumeThb: 0,
        filledOrders: 0,
        distinctCounterparties: 0,
        excludedTrades: 0,
        segments: {},
      });
    }
    return stats.get(userId)!;
  };

  for (const t of ctx.closed) {
    if (!inWindow(t.sale.releasedAt, w)) continue;
    const s = get(t.sale.sellerId);
    s.qualifyingTrades += 1;
    s.winningTrades += t.profitThb > 0 ? 1 : 0;
    s.realizedProfitThb += t.profitThb;
    s.costBasisThb += t.costThb;
    s.bestTradeRoiPct = Math.max(s.bestTradeRoiPct ?? -Infinity, t.roiPct);
    for (const seg of [`GAME:${t.sale.game}`, `GRADER:${t.sale.gradingCompany}`]) {
      const cur = s.segments[seg] ?? { profitThb: 0, volumeThb: 0, trades: 0 };
      s.segments[seg] = { profitThb: cur.profitThb + t.profitThb, volumeThb: cur.volumeThb + t.sale.amountThb, trades: cur.trades + 1 };
    }
    const day = t.sale.releasedAt.toISOString().slice(0, 10);
    if (!days.has(s.userId)) days.set(s.userId, new Map());
    days.get(s.userId)!.set(day, (days.get(s.userId)!.get(day) ?? 0) + t.profitThb);
  }

  for (const sale of ctx.sales) {
    if (!inWindow(sale.releasedAt, w)) continue;
    if (ctx.activeFlags(sale.id).length > 0) get(sale.sellerId).excludedTrades += 1;
    if (!ctx.countsForVolume(sale)) continue;
    for (const [me, other] of [
      [sale.buyerId, sale.sellerId],
      [sale.sellerId, sale.buyerId],
    ] as const) {
      if (ctx.banned.has(me)) continue;
      const s = get(me);
      s.volumeThb += sale.amountThb;
      s.filledOrders += 1;
      if (!counterparties.has(me)) counterparties.set(me, new Set());
      counterparties.get(me)!.add(other);
    }
  }

  for (const s of stats.values()) {
    s.distinctCounterparties = counterparties.get(s.userId)?.size ?? 0;
    s.roiPct = s.costBasisThb > 0 ? (s.realizedProfitThb / s.costBasisThb) * 100 : null;
    s.winRatePct = s.qualifyingTrades > 0 ? (s.winningTrades / s.qualifyingTrades) * 100 : null;
    if (s.bestTradeRoiPct === -Infinity) s.bestTradeRoiPct = null;
    // Consecutive trading days with a net profit, counting back from the latest.
    const byDay = [...(days.get(s.userId) ?? new Map()).entries()].sort(([a], [b]) => (a < b ? 1 : -1));
    let streak = 0;
    for (const [, net] of byDay) {
      if (net > 0) streak += 1;
      else break;
    }
    s.greenDayStreak = streak;
  }
  return stats;
}

const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

/** Step 4b: rank every board from one window's figures. */
function rankBoards(stats: Map<string, TraderStats>): Board[] {
  const all = [...stats.values()];
  const board = (
    category: LeaderboardCategory,
    segment: string,
    eligible: TraderStats[],
    score: (s: TraderStats) => number,
    metrics: (s: TraderStats) => Prisma.InputJsonObject,
    tiebreak: (s: TraderStats) => number = () => 0,
  ): Board => ({
    category,
    segment,
    rows: eligible
      .sort((a, b) => score(b) - score(a) || tiebreak(b) - tiebreak(a))
      .slice(0, MAX_RANKS)
      .map((s, i) => ({ userId: s.userId, rank: i + 1, score: score(s), metrics: metrics(s) })),
  });
  const base = (s: TraderStats) => ({ trades: s.qualifyingTrades, profitThb: s.realizedProfitThb });

  const boards: Board[] = [
    board(
      "WHALE",
      "ALL",
      all.filter((s) => s.qualifyingTrades > 0),
      (s) => s.realizedProfitThb,
      (s) => ({ ...base(s), roiPct: round1(s.roiPct) }),
    ),
    board(
      "ALPHA",
      "ALL",
      all.filter((s) => s.qualifyingTrades >= MIN_ROI_TRADES && s.roiPct != null),
      (s) => s.roiPct!,
      (s) => ({ ...base(s), roiPct: round1(s.roiPct), bestTradeRoiPct: round1(s.bestTradeRoiPct) }),
    ),
    board(
      "CONSISTENCY",
      "ALL",
      all.filter((s) => s.qualifyingTrades >= MIN_CONSISTENCY_TRADES && (s.winRatePct ?? 0) >= MIN_WIN_RATE),
      (s) => s.winRatePct!,
      (s) => ({ ...base(s), winRatePct: round1(s.winRatePct), greenDayStreak: s.greenDayStreak }),
      (s) => s.greenDayStreak,
    ),
    board(
      "MARKET_MAKER",
      "ALL",
      all.filter((s) => s.distinctCounterparties >= MIN_COUNTERPARTIES),
      (s) => s.volumeThb,
      (s) => ({ volumeThb: s.volumeThb, filledOrders: s.filledOrders, counterparties: s.distinctCounterparties }),
      (s) => s.filledOrders,
    ),
  ];

  const segments = new Set(all.flatMap((s) => Object.keys(s.segments)));
  for (const segment of segments) {
    boards.push(
      board(
        "SPECIALIST",
        segment,
        all.filter((s) => (s.segments[segment]?.trades ?? 0) > 0),
        (s) => s.segments[segment].profitThb,
        (s) => ({ ...s.segments[segment] }),
        (s) => s.segments[segment].volumeThb,
      ),
    );
  }
  return boards;
}

/** Step 5: replace one window's stored stats and boards. */
async function storeWindow(w: Window, stats: Map<string, TraderStats>, boards: Board[], computedAt: Date) {
  // Segment figures only feed the specialist boards; they aren't stored per user.
  const statRows = [...stats.values()].map((s) => ({
    userId: s.userId,
    qualifyingTrades: s.qualifyingTrades,
    winningTrades: s.winningTrades,
    realizedProfitThb: s.realizedProfitThb,
    costBasisThb: s.costBasisThb,
    roiPct: s.roiPct,
    bestTradeRoiPct: s.bestTradeRoiPct,
    winRatePct: s.winRatePct,
    greenDayStreak: s.greenDayStreak,
    volumeThb: s.volumeThb,
    filledOrders: s.filledOrders,
    distinctCounterparties: s.distinctCounterparties,
    excludedTrades: s.excludedTrades,
    period: w.period,
    periodStart: w.periodStart,
    computedAt,
  }));
  const snapshotRows = boards.flatMap((b) =>
    b.rows.map((r) => ({
      category: b.category,
      period: w.period,
      periodStart: w.periodStart,
      segment: b.segment,
      userId: r.userId,
      rank: r.rank,
      score: r.score,
      metrics: r.metrics,
      computedAt,
    })),
  );
  await prisma.$transaction([
    prisma.userTradeStats.deleteMany({ where: { period: w.period, periodStart: w.periodStart } }),
    prisma.userTradeStats.createMany({ data: statRows }),
    prisma.leaderboardSnapshot.deleteMany({ where: { period: w.period, periodStart: w.periodStart } }),
    prisma.leaderboardSnapshot.createMany({ data: snapshotRows }),
  ]);
}

/** Badges for a closed week or month: top 10, top 50, and top 1% on boards of 100+ traders. */
async function awardBadges(w: Window, boards: Board[]) {
  const data = boards.flatMap((b) =>
    b.rows.flatMap((r) => {
      const onePercent = b.rows.length >= 100 && r.rank <= Math.ceil(b.rows.length * 0.01);
      const tier = r.rank <= 10 ? "TOP_10" : onePercent ? "TOP_1_PERCENT" : r.rank <= 50 ? "TOP_50" : null;
      return tier
        ? [{ userId: r.userId, category: b.category, period: w.period, periodStart: w.periodStart, segment: b.segment, tier, rank: r.rank }]
        : [];
    }),
  );
  if (data.length > 0) await prisma.leaderboardBadge.createMany({ data, skipDuplicates: true });
  return data.length;
}

/**
 * Rebuilds every leaderboard: logs guardrail flags, recomputes the current
 * daily, weekly, monthly and all-time windows, and awards badges for the
 * week and month that just closed (once — awarding is idempotent).
 */
export async function runLeaderboardPipeline(now = new Date()) {
  const ctx = await loadContext();

  const saleById = new Map(ctx.sales.map((s) => [s.id, s]));
  const logRows = [...ctx.flags.entries()].flatMap(([saleId, list]) => {
    const sale = saleById.get(saleId)!;
    return list.map((f) => ({ escrowTransactionId: saleId, buyerId: sale.buyerId, sellerId: sale.sellerId, ...f }));
  });
  if (logRows.length > 0) await prisma.antiCheatLog.createMany({ data: logRows, skipDuplicates: true });

  const computedAt = new Date();
  for (const period of PERIODS) {
    const w = currentWindow(period, now);
    const stats = computeStats(ctx, w);
    await storeWindow(w, stats, rankBoards(stats), computedAt);
  }

  let badges = 0;
  for (const period of ["WEEKLY", "MONTHLY"] as const) {
    const w = previousWindow(period, now);
    badges += await awardBadges(w, rankBoards(computeStats(ctx, w)));
  }

  return { sales: ctx.sales.length, closedTrades: ctx.closed.length, flagged: ctx.flags.size, badges };
}
