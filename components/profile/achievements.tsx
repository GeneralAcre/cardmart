"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Bot,
  Boxes,
  Coins,
  Crown,
  Gavel,
  Gem,
  Lock,
  Medal,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Achievement, AchievementIcon, AchievementTier } from "@/lib/achievements";
import { ACHIEVEMENT_GROUPS } from "@/lib/achievement-groups";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/components/landing/language-provider";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  verified: BadgeCheck,
  tag: Tag,
  store: Store,
  coins: Coins,
  gem: Gem,
  bag: ShoppingBag,
  boxes: Boxes,
  gavel: Gavel,
  star: Star,
  bot: Bot,
  users: Users,
  crown: Crown,
  trophy: Trophy,
  medal: Medal,
};

// A metallic rim per tier, and a darker face inside it.
const RIM: Record<AchievementTier, string> = {
  bronze: "from-orange-200 via-orange-500 to-orange-900",
  silver: "from-zinc-100 via-zinc-400 to-zinc-700",
  gold: "from-yellow-100 via-amber-400 to-amber-700",
};
const FACE: Record<AchievementTier, string> = {
  bronze: "from-orange-950 to-stone-900 text-orange-200",
  silver: "from-zinc-800 to-zinc-950 text-zinc-100",
  gold: "from-amber-950 to-stone-900 text-amber-200",
};

const HEXAGON = "[clip-path:polygon(50%_0%,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]";

/** The badge itself: a hexagon with a metal rim when earned, grey with a lock until then. */
function BadgeEmblem({ achievement, size }: { achievement: Achievement; size: "md" | "lg" }) {
  const Icon = ICONS[achievement.icon];
  const { earned, tier } = achievement;
  return (
    <div
      className={cn(
        "relative shrink-0 bg-gradient-to-br p-[5%]",
        HEXAGON,
        size === "lg" ? "size-36" : "size-20",
        earned ? RIM[tier] : "from-zinc-500 via-zinc-700 to-zinc-800",
      )}
    >
      <div
        className={cn(
          "flex size-full items-center justify-center bg-gradient-to-br",
          HEXAGON,
          earned ? FACE[tier] : "from-zinc-800 to-zinc-950 text-zinc-600",
        )}
      >
        <Icon className={size === "lg" ? "size-14" : "size-8"} strokeWidth={1.5} />
      </div>
      {!earned && (
        <Lock
          className={cn("absolute inset-0 m-auto text-white drop-shadow", size === "lg" ? "size-10" : "size-6")}
          fill="currentColor"
        />
      )}
    </div>
  );
}

/** The profile's Badges tab: every badge, earned first; click one for what it means and how to get it. */
export function Achievements({ achievements }: { achievements: Achievement[] }) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = achievements.find((a) => a.id === openId) ?? null;
  const [mineOnly, setMineOnly] = useState(false);
  const earnedCount = achievements.filter((a) => a.earned).length;
  const shown = mineOnly ? achievements.filter((a) => a.earned) : achievements;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        {/* All badges, or only the ones you have. */}
        <div className="bg-muted flex w-fit rounded-lg p-0.5 text-xs font-medium">
          {[
            { mine: false, label: t("All badges") },
            { mine: true, label: t("My badges") },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setMineOnly(o.mine)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                mineOnly === o.mine ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          {t("{earned} of {total} badges earned", { earned: earnedCount, total: achievements.length })}
        </p>
      </div>

      {mineOnly && shown.length === 0 && (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          {t("No badges yet. Switch to All badges to see how to earn them.")}
        </p>
      )}

      {ACHIEVEMENT_GROUPS.map((group) => {
        const inGroup = achievements.filter((a) => a.group === group.id);
        const items = shown.filter((a) => a.group === group.id);
        if (items.length === 0) return null;
        return (
          <section key={group.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-semibold">{t(group.name)}</h3>
                <p className="text-muted-foreground text-sm">{t(group.description)}</p>
              </div>
              <span className="text-muted-foreground text-sm">
                {t("{earned} of {total} badges earned", {
                  earned: inGroup.filter((a) => a.earned).length,
                  total: inGroup.length,
                })}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(a.id)}
                    className="bg-card hover:bg-accent flex size-full flex-col items-center gap-2 rounded-2xl border px-4 py-6 text-center transition-colors"
                  >
                    <BadgeEmblem achievement={a} size="md" />
                    <span className="mt-2 text-sm font-semibold">{t(a.name)}</span>
                    <span className="text-muted-foreground line-clamp-3 text-xs">{t(a.howToEarn, a.params)}</span>
                    {!a.earned && a.progress && (
                      <span className="mt-auto flex w-full flex-col gap-1 pt-1">
                        <span className="bg-muted h-1 w-full overflow-hidden rounded-full">
                          <span
                            className="bg-foreground/60 block h-full rounded-full"
                            style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }}
                          />
                        </span>
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                          {a.progress.current}/{a.progress.target}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        <DialogContent className="bg-card flex flex-col items-center gap-0 rounded-2xl px-8 py-10 text-center sm:max-w-md">
          {open && (
            <>
              <BadgeEmblem achievement={open} size="lg" />
              <DialogTitle className="mt-6 text-lg">{t(open.name)}</DialogTitle>
              <DialogDescription className="mt-2 text-sm">{t(open.description)}</DialogDescription>
              <span
                className={cn(
                  "mt-4 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  open.earned ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
                )}
              >
                {open.earned
                  ? t("Earned")
                  : open.progress
                    ? t("{current} of {target} done", open.progress)
                    : t("Not earned yet")}
              </span>
              <h3 className="mt-6 text-base font-semibold">{t("How to earn")}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{t(open.howToEarn, open.params)}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
