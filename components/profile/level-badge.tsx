"use client";

import Link from "next/link";
import { Medal } from "lucide-react";

import type { Level } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

// Colour steps up with the level: grey for new users, green mid-way, gold at the top.
function levelClass(level: number) {
  if (level >= 5) return "bg-amber-500/15 text-amber-500";
  if (level >= 3) return "bg-success/15 text-success";
  return "bg-secondary text-foreground";
}

/** The user's Rewards level (lib/rewards.ts) beside their name; opens the Rewards page. */
export function LevelBadge({ level, xp, className }: { level: Level; xp: number; className?: string }) {
  const t = useT();
  return (
    <Link
      href="/rewards"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80",
        levelClass(level.level),
        className,
      )}
      title={`${xp.toLocaleString()} XP`}
    >
      <Medal className="size-3.5" />
      {t("Level {n}", { n: level.level })} · {t(level.name)}
    </Link>
  );
}
