import "server-only";

import { prisma } from "@/lib/prisma";
import { isTopTierSeller, type SellerStanding } from "@/lib/seller-tier";

// XP and levels for the Rewards page. Every point comes from something the
// user has really done on CardMart, counted straight from their records each
// time the page loads: there's no separate XP ledger to drift out of step,
// nothing to "claim", and no way to earn XP without doing the thing. Since
// it only counts finished actions (never "this week"), XP never goes down.

export interface Level {
  level: number;
  name: string;
  /** Total XP needed to reach this level. */
  minXp: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: "Rookie", minXp: 0 },
  { level: 2, name: "Collector", minXp: 250 },
  { level: 3, name: "Trader", minXp: 600 },
  { level: 4, name: "Dealer", minXp: 1200 },
  { level: 5, name: "Shark", minXp: 2200 },
  { level: 6, name: "Legend", minXp: 3600 },
];

export type TaskGroup = "start" | "trade";

export interface RewardTask {
  id: string;
  group: TaskGroup;
  /** English template, translated by the page; "{n}" is the current step's target. */
  title: string;
  n: number;
  description: string;
  /** Where to go to do it. */
  href: string;
  /** XP for the step shown now: the next unfinished tier, or the last one once all are done. */
  xp: number;
  current: number;
  target: number;
  done: boolean;
  /** XP already earned from this task's finished tiers. */
  earnedXp: number;
}

/** A task done in steps ("List 1 card", then 5, then 20), each worth its own XP. */
interface TieredTask {
  id: string;
  group: TaskGroup;
  /** "{n}" is replaced with the step's target. */
  title: string;
  /** The wording for a first step of 1 ("List your first card", not "List 1 cards"). */
  titleOne?: string;
  description: string;
  href: string;
  tiers: { target: number; xp: number }[];
  count: number;
}

function toTask(t: TieredTask): RewardTask {
  const finished = t.tiers.filter((tier) => t.count >= tier.target);
  const next = t.tiers.find((tier) => t.count < tier.target);
  const shown = next ?? t.tiers[t.tiers.length - 1];
  return {
    id: t.id,
    group: t.group,
    title: shown.target === 1 && t.titleOne ? t.titleOne : t.title,
    n: shown.target,
    description: t.description,
    href: t.href,
    xp: shown.xp,
    current: Math.min(t.count, shown.target),
    target: shown.target,
    done: next == null,
    earnedXp: finished.reduce((sum, tier) => sum + tier.xp, 0),
  };
}

export interface Rewards {
  xp: number;
  level: Level;
  next: Level | null;
  tasks: RewardTask[];
  /** The figures behind the Top Tier Seller badge. */
  seller: SellerStanding;
  topTier: boolean;
  /** Leaderboard badges (lib/leaderboard/pipeline.ts), best one per category. */
  leaderboard: EarnedLeaderboardBadge[];
}

export async function getRewards(user: { id: string; image: string | null; kycStatus: string }): Promise<Rewards> {
  const [watching, wanted, messages, listed, bought, sold, bids, reviews, agentTasks, invited] = await Promise.all([
    prisma.watchlistItem.count({ where: { userId: user.id } }),
    prisma.wantedCard.count({ where: { userId: user.id } }),
    prisma.message.count({ where: { senderId: user.id } }),
    prisma.asset.count({ where: { sellerId: user.id } }),
    prisma.escrowTransaction.count({ where: { buyerId: user.id, status: "RELEASED" } }),
    prisma.escrowTransaction.count({ where: { sellerId: user.id, status: "RELEASED" } }),
    prisma.bid.count({ where: { bidderId: user.id } }),
    prisma.review.count({ where: { buyerId: user.id } }),
    prisma.agentMandate.count({ where: { userId: user.id } }),
    // Friends who signed up from their invite link and finished their profile.
    prisma.user.count({ where: { referredById: user.id, profileComplete: true } }),
  ]);

  const tiered: TieredTask[] = [
    // Getting started: one step each.
    { id: "photo", group: "start", title: "Add a profile photo", description: "Put a face to your store.", href: "/settings", tiers: [{ target: 1, xp: 50 }], count: user.image ? 1 : 0 },
    { id: "kyc", group: "start", title: "Verify your identity", description: "Verified sellers get a badge and more trust.", href: "/portfolio", tiers: [{ target: 1, xp: 150 }], count: user.kycStatus === "VERIFIED" ? 1 : 0 },
    { id: "watch", group: "start", title: "Watch a card", description: "Save a listing to follow its price.", href: "/marketplace", tiers: [{ target: 1, xp: 25 }], count: watching },
    { id: "wanted", group: "start", title: "Add a wanted card", description: "Get told when a card you want is listed.", href: "/portfolio", tiers: [{ target: 1, xp: 25 }], count: wanted },
    { id: "message", group: "start", title: "Message a seller", description: "Ask a question before you buy.", href: "/messages", tiers: [{ target: 1, xp: 25 }], count: messages },
    // Trading: steps that keep going.
    { id: "list", group: "trade", titleOne: "List your first card", title: "List {n} cards", description: "Put cards up for sale.", href: "/marketplace/sell", tiers: [{ target: 1, xp: 100 }, { target: 5, xp: 250 }, { target: 20, xp: 600 }], count: listed },
    { id: "buy", group: "trade", titleOne: "Buy your first card", title: "Buy {n} cards", description: "Completed purchases, after the card is checked.", href: "/marketplace", tiers: [{ target: 1, xp: 150 }, { target: 5, xp: 400 }, { target: 20, xp: 900 }], count: bought },
    { id: "sell", group: "trade", titleOne: "Sell your first card", title: "Sell {n} cards", description: "Completed sales, paid out to you.", href: "/portfolio", tiers: [{ target: 1, xp: 200 }, { target: 5, xp: 500 }, { target: 20, xp: 1000 }], count: sold },
    { id: "bid", group: "trade", titleOne: "Place your first bid", title: "Place {n} bids", description: "Bid in live auctions.", href: "/auctions", tiers: [{ target: 1, xp: 50 }, { target: 10, xp: 200 }, { target: 50, xp: 500 }], count: bids },
    { id: "review", group: "trade", titleOne: "Review your first seller", title: "Review {n} sellers", description: "Rate a seller after a purchase.", href: "/portfolio", tiers: [{ target: 1, xp: 75 }, { target: 5, xp: 200 }], count: reviews },
    { id: "agent", group: "trade", titleOne: "Start your first agent task", title: "Start {n} agent tasks", description: "Let the buying agent hunt for a card.", href: "/agent", tiers: [{ target: 1, xp: 75 }, { target: 5, xp: 200 }], count: agentTasks },
    { id: "invite", group: "trade", titleOne: "Invite your first friend", title: "Invite {n} friends", description: "Friends who sign up from your invite link or QR code.", href: "#invite", tiers: [{ target: 1, xp: 100 }, { target: 5, xp: 300 }, { target: 20, xp: 800 }], count: invited },
  ];

  const tasks = tiered.map(toTask);
  const xp = tasks.reduce((sum, task) => sum + task.earnedXp, 0);
  const level = [...LEVELS].reverse().find((l) => xp >= l.minXp) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.minXp > xp) ?? null;

  const [ratingAgg, leaderboard] = await Promise.all([
    prisma.review.aggregate({ where: { sellerId: user.id }, _avg: { rating: true }, _count: true }),
    prisma.leaderboardBadge.findMany({
      where: { userId: user.id },
      orderBy: { awardedAt: "desc" },
      select: { id: true, category: true, period: true, tier: true, rank: true, awardedAt: true },
    }),
  ]);
  const seller: SellerStanding = {
    sales: sold,
    reviews: ratingAgg._count,
    rating: ratingAgg._avg.rating,
    verified: user.kycStatus === "VERIFIED",
  };
  return { xp, level, next, tasks, seller, topTier: isTopTierSeller(seller), leaderboard: bestLeaderboardBadges(leaderboard) };
}

/** Whether a seller has the Top Tier badge, for showing beside their name on store and card pages. */
export async function isTopTierSellerById(userId: string, kycStatus: string): Promise<boolean> {
  if (kycStatus !== "VERIFIED") return false; // skip the queries for the common case
  const [sales, ratingAgg] = await Promise.all([
    prisma.escrowTransaction.count({ where: { sellerId: userId, status: "RELEASED" } }),
    prisma.review.aggregate({ where: { sellerId: userId }, _avg: { rating: true }, _count: true }),
  ]);
  return isTopTierSeller({ sales, reviews: ratingAgg._count, rating: ratingAgg._avg.rating, verified: true });
}

export interface EarnedLeaderboardBadge {
  id: string;
  category: string;
  period: string;
  tier: string;
  rank: number;
  awardedAt: Date;
}

const TIER_ORDER = ["TOP_10", "TOP_1_PERCENT", "TOP_50"];

/**
 * One badge per leaderboard category: the best tier ever reached there (then
 * the best rank). The pipeline awards a row per period, so a regular could
 * otherwise show dozens of near-identical badges.
 */
function bestLeaderboardBadges(rows: EarnedLeaderboardBadge[]): EarnedLeaderboardBadge[] {
  const best = new Map<string, EarnedLeaderboardBadge>();
  for (const row of rows) {
    const held = best.get(row.category);
    const better =
      !held ||
      TIER_ORDER.indexOf(row.tier) < TIER_ORDER.indexOf(held.tier) ||
      (row.tier === held.tier && row.rank < held.rank);
    if (better) best.set(row.category, row);
  }
  return [...best.values()];
}
