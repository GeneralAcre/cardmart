"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { AchievementIcon, AchievementTier } from "@/lib/achievements";
import { BadgeEmblem } from "@/components/profile/badge-emblem";
import { useT } from "@/components/landing/language-provider";

/**
 * The Achievements button in the profile header: the latest few badges
 * you've earned, side by side, and how many you have. Opens the
 * Achievements tab further down the profile.
 */
export function AchievementsButton({
  earned,
  total,
}: {
  earned: { id: string; icon: AchievementIcon; tier: AchievementTier }[];
  total: number;
}) {
  const t = useT();
  // Best first, so gold shows up front.
  const rank = { gold: 0, silver: 1, bronze: 2 } as const;
  const shown = [...earned].sort((a, b) => rank[a.tier] - rank[b.tier]).slice(0, 3);

  return (
    <Link
      href="/portfolio?tab=badges#profile-tabs"
      // Full width on phones, like the buttons beside it.
      className="border-input bg-background hover:bg-accent flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border pr-2 pl-1 text-xs font-medium shadow-xs transition-colors sm:flex-none"
    >
      <span className="flex -space-x-2">
        {shown.length > 0 ? (
          shown.map((b) => <BadgeEmblem key={b.id} icon={b.icon} tier={b.tier} earned size="sm" />)
        ) : (
          <BadgeEmblem icon="medal" tier="gold" earned={false} size="sm" />
        )}
      </span>
      {t("Achievements")}
      <span className="text-muted-foreground tabular-nums">
        {earned.length}/{total}
      </span>
      <ChevronRight className="text-muted-foreground size-3.5" />
    </Link>
  );
}
