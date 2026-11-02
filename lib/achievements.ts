import "server-only";

import { getRewards, type Rewards } from "@/lib/rewards";
import { TOP_TIER_SELLER } from "@/lib/seller-tier";
import type { AchievementGroup } from "@/lib/achievement-groups";

// The Badges tab on the profile: a collection of achievements, earned or
// still locked. Like XP (lib/rewards.ts), every badge is worked out from the
// user's real records each time, so there's nothing to award or claim, and a
// badge can't be earned without doing the thing.

/** Bronze for a first step, silver for keeping at it, gold for the hardest. */
export type AchievementTier = "bronze" | "silver" | "gold";

/** Names an icon in components/profile/achievements.tsx (icons can't cross to the client). */
export type AchievementIcon =
  | "verified"
  | "tag"
  | "store"
  | "coins"
  | "gem"
  | "bag"
  | "boxes"
  | "gavel"
  | "star"
  | "bot"
  | "users"
  | "crown"
  | "trophy"
  | "medal";


const GROUP_OF: Record<string, AchievementGroup> = {
  verified: "start",
  "first-listing": "start",
  "first-buy": "start",
  "first-bid": "start",
  agent: "start",
  "first-sale": "selling",
  "seasoned-seller": "selling",
  "power-seller": "selling",
  shopkeeper: "selling",
  "top-tier": "selling",
  collector: "buying",
  whale: "buying",
  "auction-regular": "buying",
  reviewer: "community",
  ambassador: "community",
  leaderboard: "community",
  "leaderboard-top-10": "community",
  legend: "community",
};

export interface Achievement {
  id: string;
  /** English; translated on the page, like every other label. */
  name: string;
  description: string;
  howToEarn: string;
  /** Values for the {placeholders} in howToEarn. */
  params?: Record<string, number>;
  icon: AchievementIcon;
  tier: AchievementTier;
  earned: boolean;
  /** How far along a counted badge is, e.g. 3 of 5 sales. */
  progress: { current: number; target: number } | null;
  group: AchievementGroup;
}

export async function getAchievements(user: { id: string; image: string | null; kycStatus: string }): Promise<Achievement[]> {
  return achievementsFrom(await getRewards(user));
}

/** The badges from rewards already loaded (the Rewards page has them anyway). */
export function achievementsFrom(rewards: Rewards): Achievement[] {
  const { counts, seller, topTier, leaderboard, level } = rewards;

  /** A badge for doing something `target` times. */
  function counted(
    id: string,
    task: string,
    target: number,
    rest: Omit<Achievement, "id" | "earned" | "progress" | "group">,
  ): Omit<Achievement, "group"> {
    const current = counts[task] ?? 0;
    return { id, ...rest, earned: current >= target, progress: target > 1 ? { current: Math.min(current, target), target } : null };
  }

  const bestTier = new Set(leaderboard.map((b) => b.tier));

  const list: Omit<Achievement, "group">[] = [
    {
      id: "verified",
      name: "Verified Collector",
      description: "CardMart staff have checked this collector's identity, so buyers and sellers know who they're dealing with.",
      howToEarn: "Verify your identity from your profile.",
      icon: "verified",
      tier: "bronze",
      earned: seller.verified,
      progress: null,
    },
    counted("first-listing", "list", 1, {
      name: "Open for Business",
      description: "Put a first card up for sale on CardMart.",
      howToEarn: "List a card for sale.",
      icon: "tag",
      tier: "bronze",
    }),
    counted("shopkeeper", "list", 20, {
      name: "Shopkeeper",
      description: "A store with plenty on the shelves: 20 cards listed for sale.",
      howToEarn: "List 20 cards for sale.",
      icon: "store",
      tier: "silver",
    }),
    counted("first-sale", "sell", 1, {
      name: "First Sale",
      description: "Sold a first card and got paid, after the warehouse checked it.",
      howToEarn: "Complete a sale.",
      icon: "coins",
      tier: "bronze",
    }),
    counted("seasoned-seller", "sell", 5, {
      name: "Seasoned Seller",
      description: "Five completed sales, each one checked and paid out.",
      howToEarn: "Complete 5 sales.",
      icon: "coins",
      tier: "silver",
    }),
    counted("power-seller", "sell", 20, {
      name: "Power Seller",
      description: "Twenty completed sales: one of the busiest sellers on CardMart.",
      howToEarn: "Complete 20 sales.",
      icon: "gem",
      tier: "gold",
    }),
    counted("first-buy", "buy", 1, {
      name: "First Pull",
      description: "Bought a first card on CardMart and received it after it was checked.",
      howToEarn: "Complete a purchase.",
      icon: "bag",
      tier: "bronze",
    }),
    counted("collector", "buy", 5, {
      name: "Collector",
      description: "Five completed purchases: a collection is taking shape.",
      howToEarn: "Complete 5 purchases.",
      icon: "boxes",
      tier: "silver",
    }),
    counted("whale", "buy", 20, {
      name: "Whale",
      description: "Twenty completed purchases. Sellers are glad to see you.",
      howToEarn: "Complete 20 purchases.",
      icon: "gem",
      tier: "gold",
    }),
    counted("first-bid", "bid", 1, {
      name: "Paddle Up",
      description: "Placed a first bid in a live auction.",
      howToEarn: "Bid in an auction.",
      icon: "gavel",
      tier: "bronze",
    }),
    counted("auction-regular", "bid", 50, {
      name: "Auction Regular",
      description: "Fifty bids placed across CardMart's live auctions.",
      howToEarn: "Place 50 bids in auctions.",
      icon: "gavel",
      tier: "silver",
    }),
    counted("reviewer", "review", 1, {
      name: "Honest Review",
      description: "Rated a seller after a purchase, helping other buyers choose.",
      howToEarn: "Review a seller after buying from them.",
      icon: "star",
      tier: "bronze",
    }),
    counted("agent", "agent", 1, {
      name: "Card Hunter",
      description: "Sent the buying agent out to find a card.",
      howToEarn: "Start a task for the buying agent.",
      icon: "bot",
      tier: "bronze",
    }),
    counted("ambassador", "invite", 5, {
      name: "Ambassador",
      description: "Brought five friends to CardMart who finished setting up their profile.",
      howToEarn: "Invite 5 friends with your invite link or QR code.",
      icon: "users",
      tier: "silver",
    }),
    {
      id: "top-tier",
      name: "Top Tier Seller",
      description: "A verified seller with a strong record of completed sales and high ratings from buyers.",
      howToEarn: "Complete {sales} sales and get {reviews} reviews averaging {rating}+ stars, with your ID verified.",
      params: { sales: TOP_TIER_SELLER.sales, reviews: TOP_TIER_SELLER.reviews, rating: TOP_TIER_SELLER.rating },
      icon: "crown",
      tier: "gold",
      earned: topTier,
      progress: null,
    },
    {
      id: "leaderboard",
      name: "On the Board",
      description: "Finished in the top 50 of a CardMart leaderboard.",
      howToEarn: "Finish in the top 50 of any leaderboard.",
      icon: "trophy",
      tier: "silver",
      earned: leaderboard.length > 0,
      progress: null,
    },
    {
      id: "leaderboard-top-10",
      name: "Top 10",
      description: "Finished in the top 10 of a CardMart leaderboard.",
      howToEarn: "Finish in the top 10 of any leaderboard.",
      icon: "trophy",
      tier: "gold",
      earned: bestTier.has("TOP_10"),
      progress: null,
    },
    {
      id: "legend",
      name: "Legend",
      description: "Reached the highest Rewards level.",
      howToEarn: "Earn enough XP to reach Level 6, Legend.",
      icon: "medal",
      tier: "gold",
      earned: level.level >= 6,
      progress: null,
    },
  ];
  return list.map((a) => ({ ...a, group: GROUP_OF[a.id] ?? "community" }));
}
