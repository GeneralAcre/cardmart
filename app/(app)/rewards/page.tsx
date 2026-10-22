import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Crown, Sparkles, Trophy } from "lucide-react";

import { CommunityTabs } from "@/components/community/community-tabs";
import { Progress } from "@/components/ui/progress";
import { LEVELS, getRewards, type RewardTask, type Rewards } from "@/lib/rewards";
import { TOP_TIER_SELLER } from "@/lib/seller-tier";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

// Community → Rewards: the user's XP and level, and the tasks that earn more.
// Everything is counted from what they've actually done (lib/rewards.ts).
export default async function RewardsPage() {
  const user = await getCurrentUser();
  const [rewards, t] = await Promise.all([getRewards(user), getT()]);
  const { xp, level, next, tasks } = rewards;

  const span = next ? next.minXp - level.minXp : 1;
  const into = next ? xp - level.minXp : 1;
  const start = tasks.filter((task) => task.group === "start");
  const trade = tasks.filter((task) => task.group === "trade");

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("Rewards")}</h1>
          <p className="text-muted-foreground text-sm">{t("Earn XP for what you do on CardMart and level up.")}</p>
        </div>
        <CommunityTabs />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Where the user stands: level, XP and how far to the next one. */}
          <section className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="eyebrow text-muted-foreground">{t("Level {n}", { n: level.level })}</span>
                <span className="text-2xl font-semibold">{t(level.name)}</span>
              </div>
              <span className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums">{xp.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm font-medium">XP</span>
              </span>
            </div>
            <Progress value={(into / span) * 100} className="[&>[data-slot=progress-indicator]]:bg-success h-2.5" />
            <p className="text-muted-foreground text-sm">
              {next
                ? t("{xp} XP to Level {n}, {name}", { xp: (next.minXp - xp).toLocaleString(), n: next.level, name: t(next.name) })
                : t("Top level reached. Every task is done.")}
            </p>
          </section>

          <BadgesSection rewards={rewards} t={t} />
          <TaskSection title={t("Getting started")} tasks={start} t={t} />
          <TaskSection title={t("Trading")} tasks={trade} t={t} />
        </div>

        {/* Every level and what it takes. */}
        <aside className="bg-card flex h-fit flex-col rounded-2xl border">
          <h2 className="eyebrow text-muted-foreground border-b px-4 py-3">{t("Levels")}</h2>
          <ol className="flex flex-col divide-y">
            {LEVELS.map((l) => {
              const reached = xp >= l.minXp;
              const current = l.level === level.level;
              return (
                <li key={l.level} className={cn("flex items-center gap-3 px-4 py-3", current && "bg-secondary/60")}>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums",
                      reached ? "bg-success border-success text-success-foreground" : "text-muted-foreground",
                    )}
                  >
                    {l.level}
                  </span>
                  <span className={cn("flex-1 text-sm font-medium", !reached && "text-muted-foreground")}>{t(l.name)}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{l.minXp.toLocaleString()} XP</span>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  WHALE: "Whale",
  ALPHA: "Alpha",
  CONSISTENCY: "Consistent",
  MARKET_MAKER: "Market Maker",
  SPECIALIST: "Specialist",
};
const TIER_LABEL: Record<string, string> = { TOP_10: "Top 10", TOP_1_PERCENT: "Top 1%", TOP_50: "Top 50" };
const PERIOD_LABEL: Record<string, string> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", ALL_TIME: "all-time" };

/** The badges a user can hold: ID verified, Top Tier Seller, and leaderboard finishes. */
function BadgesSection({ rewards, t }: { rewards: Rewards; t: Translate }) {
  const { seller, topTier, leaderboard } = rewards;
  // The Top Tier rule as a checklist, so a seller can see exactly what's left.
  const checklist = [
    { label: t("{n} completed sales", { n: TOP_TIER_SELLER.sales }), now: `${Math.min(seller.sales, TOP_TIER_SELLER.sales)}/${TOP_TIER_SELLER.sales}`, ok: seller.sales >= TOP_TIER_SELLER.sales },
    { label: t("{n} reviews", { n: TOP_TIER_SELLER.reviews }), now: `${Math.min(seller.reviews, TOP_TIER_SELLER.reviews)}/${TOP_TIER_SELLER.reviews}`, ok: seller.reviews >= TOP_TIER_SELLER.reviews },
    { label: t("{n}+ star rating", { n: TOP_TIER_SELLER.rating }), now: seller.rating != null ? seller.rating.toFixed(1) : "—", ok: (seller.rating ?? 0) >= TOP_TIER_SELLER.rating },
    { label: t("ID verified"), now: seller.verified ? t("Yes") : t("No"), ok: seller.verified },
  ];

  return (
    <section className="bg-card flex flex-col rounded-2xl border">
      <h2 className="eyebrow text-muted-foreground border-b px-4 py-3">{t("Badges")}</h2>
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Top Tier Seller, with what's still needed. */}
        <div className="flex flex-col gap-3 p-4">
          <BadgeTitle icon={Crown} earned={topTier} title={t("Top Tier Seller")} />
          <ul className="flex flex-col gap-1.5 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                {c.ok ? <Check className="text-success size-3.5 shrink-0" /> : <span className="bg-muted-foreground/40 size-1.5 shrink-0 rounded-full mx-1" />}
                <span className={cn("flex-1", c.ok ? "text-muted-foreground" : "")}>{c.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{c.now}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* ID verified. */}
          <div className="flex flex-col gap-1.5">
            <BadgeTitle icon={BadgeCheck} earned={seller.verified} title={t("ID verified")} />
            {!seller.verified && (
              <Link href="/portfolio" className="text-muted-foreground hover:text-foreground w-fit text-xs underline underline-offset-4">
                {t("Verify your identity")}
              </Link>
            )}
          </div>
          {/* Leaderboard finishes: the best one per category. */}
          <div className="flex flex-col gap-2">
            <BadgeTitle icon={Trophy} earned={leaderboard.length > 0} title={t("Leaderboard badges")} />
            {leaderboard.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {leaderboard.map((b) => (
                  <li
                    key={b.id}
                    className="bg-success/15 text-success rounded-md px-2 py-1 text-xs font-semibold"
                    title={t("Rank #{rank}, {period}", { rank: b.rank, period: t(PERIOD_LABEL[b.period] ?? b.period) })}
                  >
                    {t(TIER_LABEL[b.tier] ?? b.tier)} · {t(CATEGORY_LABEL[b.category] ?? b.category)}
                  </li>
                ))}
              </ul>
            ) : (
              <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground w-fit text-xs underline underline-offset-4">
                {t("Finish in a leaderboard's top 50 to earn one")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A badge name with its icon: green once earned, grey until then. */
function BadgeTitle({ icon: Icon, earned, title }: { icon: typeof Crown; earned: boolean; title: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border",
          earned ? "bg-success border-success text-success-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className={cn("text-sm font-semibold", !earned && "text-muted-foreground")}>{title}</span>
    </span>
  );
}

function TaskSection({ title, tasks, t }: { title: string; tasks: RewardTask[]; t: Translate }) {
  const done = tasks.filter((task) => task.done).length;
  return (
    <section className="bg-card flex flex-col rounded-2xl border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="eyebrow text-muted-foreground">{title}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{t("{done} of {total} done", { done, total: tasks.length })}</span>
      </div>
      <ul className="flex flex-col divide-y">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 px-4 py-3.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border",
                task.done ? "bg-success border-success text-success-foreground" : "text-muted-foreground",
              )}
            >
              {task.done ? <Check className="size-4" /> : <Sparkles className="size-4" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cn("text-sm font-medium", task.done && "text-muted-foreground line-through decoration-1")}>
                {t(task.title, { n: task.n })}
              </span>
              <span className="text-muted-foreground text-xs">{t(task.description)}</span>
              {/* Multi-step tasks show how far along the current step is. */}
              {task.target > 1 && !task.done && (
                <div className="flex items-center gap-2 pt-0.5">
                  <Progress value={(task.current / task.target) * 100} className="h-1.5 max-w-48" />
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {task.current}/{task.target}
                  </span>
                </div>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                task.done ? "text-muted-foreground" : "bg-success/15 text-success",
              )}
            >
              +{task.xp} XP
            </span>
            {!task.done && (
              <Link
                href={task.href}
                aria-label={t("Go: {task}", { task: t(task.title, { n: task.n }) })}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
              >
                <ArrowRight className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
