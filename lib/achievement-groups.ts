// The sections of the Badges tab (components/profile/achievements.tsx), kept
// apart from lib/achievements.ts so the page in the browser can read them.

export const ACHIEVEMENT_GROUPS = [
  { id: "start", name: "Getting started", description: "Setting up and taking your first steps on CardMart." },
  { id: "selling", name: "Selling", description: "Listing cards and completing sales." },
  { id: "buying", name: "Buying", description: "Purchases and auctions." },
  { id: "community", name: "Community", description: "Reviews, invites, leaderboards and levels." },
] as const;
export type AchievementGroup = (typeof ACHIEVEMENT_GROUPS)[number]["id"];
