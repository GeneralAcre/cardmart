import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Bell,
  Bot,
  Camera,
  Check,
  Coins,
  Compass,
  Crown,
  Eye,
  Gavel,
  ListChecks,
  MessageCircle,
  ShoppingBag,
  Star,
  Tag,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { CommunityTabs } from "@/components/community/community-tabs";
import { PageTour } from "@/components/tour/page-tour";
import { ItemShareButton } from "@/components/item/share-button";
import { BadgeEmblem } from "@/components/profile/badge-emblem";
import { Progress } from "@/components/ui/progress";
import { achievementsFrom, type AchievementTier } from "@/lib/achievements";
import { qrPath } from "@/lib/qr";
import { referralUrl } from "@/lib/referral";
import { LEVELS, getRewards, type RewardTask, type Rewards } from "@/lib/rewards";
import { TOP_TIER_SELLER } from "@/lib/seller-tier";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

// Community → Rewards: the user's XP and level, and the tasks that earn more.
// Everything is counted from what they've actually done (lib/rewards.ts).

/** The level medal's metal: bronze for the first two levels, silver for the middle two, gold at the top. */
function levelTier(level: number): AchievementTier {
  return level >= 5 ? "gold" : level >= 3 ? "silver" : "bronze";
}

const TASK_ICONS: Record<string, LucideIcon> = {
  photo: Camera,
  kyc: BadgeCheck,
  watch: Eye,
  wanted: Bell,
  tour: Compass,
  message: MessageCircle,
  list: Tag,
  buy: ShoppingBag,
  sell: Coins,
  bid: Gavel,
  review: Star,
  agent: Bot,
  invite: UserPlus,
};

export default async function RewardsPage() {
  const user = await getCurrentUser();
  const [rewards, t] = await Promise.all([getRewards(user), getT()]);
  const { xp, level, next, tasks } = rewards;
  const achievements = achievementsFrom(rewards);
  const earnedBadges = achievements.filter((a) => a.earned);

  const span = next ? next.minXp - level.minXp : 1;
  const into = next ? xp - level.minXp : 1;
  const start = tasks.filter((task) => task.group === "start");
  const trade = tasks.filter((task) => task.group === "trade");
  const tasksDone = tasks.filter((task) => task.done).length;

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("Rewards")}</h1>
          <p className="text-muted-foreground text-sm">{t("Earn XP for what you do on CardMart and level up.")}</p>
        </div>
        <CommunityTabs />
      </div>
      <PageTour id="rewards" />

      <div className="flex flex-col gap-6">
        <div data-tour="level">
          <LevelHero rewards={rewards} span={span} into={into} t={t} />
        </div>

        {/* Three quick numbers. */}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={ListChecks} label={t("Tasks done")} value={`${tasksDone}/${tasks.length}`} />
          <Stat icon={Award} label={t("Badges earned")} value={`${earnedBadges.length}/${achievements.length}`} />
          <Stat
            icon={Zap}
            label={next ? t("XP to next level") : t("Top level")}
            value={next ? (next.minXp - xp).toLocaleString() : t(level.name)}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-8" data-tour="tasks">
            <TaskSection title={t("Getting started")} tasks={start} t={t} />
            <TaskSection title={t("Trading")} tasks={trade} t={t} />
          </div>

          <div className="flex h-fit flex-col gap-6">
            {/* A taste of the badges, with the full collection on the profile. */}
            <section className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{t("Badges")}</h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {earnedBadges.length}/{achievements.length}
                </span>
              </div>
              <ul className="grid grid-cols-4 gap-2">
                {[...earnedBadges, ...achievements.filter((a) => !a.earned)].slice(0, 8).map((a) => (
                  <li key={a.id} title={t(a.name)} className="flex justify-center">
                    <BadgeEmblem icon={a.icon} tier={a.tier} earned={a.earned} size="sm" className="size-14" />
                  </li>
                ))}
              </ul>
              <Link
                href="/portfolio?tab=badges#profile-tabs"
                className="bg-secondary hover:bg-accent flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors"
              >
                {t("View all achievements")}
                <ArrowRight className="size-4" />
              </Link>
            </section>
            <TopTierCard rewards={rewards} t={t} />
            {user.handle && <InviteCard handle={user.handle} t={t} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Where the user stands: a level medal, XP and the bar to the next level, then every level as a road. */
function LevelHero({ rewards, span, into, t }: { rewards: Rewards; span: number; into: number; t: Translate }) {
  const { xp, level, next } = rewards;
  const percent = Math.round((into / span) * 100);
  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border">
      {/* A soft glow in the medal's metal behind the top half. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-60"
        style={{
          backgroundImage: `radial-gradient(60% 100% at 15% 0%, color-mix(in oklab, ${
            levelTier(level.level) === "gold" ? "#f2b500" : levelTier(level.level) === "silver" ? "#a8adb8" : "#c8702f"
          } 25%, transparent), transparent 70%)`,
        }}
      />
      <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <BadgeEmblem icon="medal" tier={levelTier(level.level)} earned size="lg" className="mx-auto size-28 sm:mx-0 sm:size-36" />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="eyebrow text-success">{t("Level {n}", { n: level.level })}</span>
              <span className="text-3xl font-bold sm:text-4xl">{t(level.name)}</span>
            </div>
            <span className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums sm:text-4xl">{xp.toLocaleString()}</span>
              <span className="text-muted-foreground text-sm font-semibold">XP</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Progress value={percent} className="[&>[data-slot=progress-indicator]]:bg-success h-3" />
            <div className="text-muted-foreground flex justify-between gap-3 text-sm">
              <span>
                {next
                  ? t("{xp} XP to Level {n}, {name}", { xp: (next.minXp - xp).toLocaleString(), n: next.level, name: t(next.name) })
                  : t("Top level reached. Every task is done.")}
              </span>
              {next && <span className="font-semibold tabular-nums">{percent}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Every level along a road: reached ones lit, the current one ringed. */}
      <ol className="relative grid grid-cols-6 border-t px-2 py-5 sm:px-6">
        {/* Through the middle of the circles: the list's top padding (1.25rem) plus half a circle (1rem). */}
        <span aria-hidden className="bg-border absolute top-[calc(2.25rem-1px)] right-[8.33%] left-[8.33%] h-0.5" />
        <span
          aria-hidden
          className="bg-success absolute top-[calc(2.25rem-1px)] left-[8.33%] h-0.5"
          style={{ width: `${((level.level - 1) / (LEVELS.length - 1)) * 83.33}%` }}
        />
        {LEVELS.map((l) => {
          const reached = xp >= l.minXp;
          const current = l.level === level.level;
          return (
            <li key={l.level} className="relative flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "bg-card flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums",
                  reached ? "border-success bg-success text-success-foreground" : "text-muted-foreground",
                  current && "ring-success/30 ring-4",
                )}
              >
                {reached && !current ? <Check className="size-4" /> : l.level}
              </span>
              <span className={cn("text-xs font-semibold", !reached && "text-muted-foreground")}>{t(l.name)}</span>
              <span className="text-muted-foreground hidden text-[11px] tabular-nums sm:block">{l.minXp.toLocaleString()} XP</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-3">
      <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-muted-foreground truncate text-xs">{label}</span>
        <span className="truncate text-lg font-bold tabular-nums">{value}</span>
      </div>
    </div>
  );
}

/** One section of tasks as cards: icon, what to do, progress, the XP it pays and a way to go do it. */
function TaskSection({ title, tasks, t }: { title: string; tasks: RewardTask[]; t: Translate }) {
  const done = tasks.filter((task) => task.done).length;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-muted-foreground text-sm tabular-nums">{t("{done} of {total} done", { done, total: tasks.length })}</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => {
          const Icon = TASK_ICONS[task.id] ?? Star;
          const label = t(task.title, { n: task.n });
          return (
            <li
              key={task.id}
              className={cn("bg-card flex flex-col gap-4 rounded-2xl border p-4", task.done && "opacity-70")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    task.done ? "bg-success text-success-foreground" : "bg-secondary text-foreground",
                  )}
                >
                  {task.done ? <Check className="size-5" /> : <Icon className="size-5" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{label}</span>
                  <span className="text-muted-foreground text-xs">{t(task.description)}</span>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                    task.done ? "bg-secondary text-muted-foreground" : "bg-success/15 text-success",
                  )}
                >
                  <Zap className="size-3" fill="currentColor" />
                  {task.xp}
                </span>
              </div>
              <div className="mt-auto flex items-center gap-3">
                {task.done ? (
                  <span className="text-success flex items-center gap-1.5 text-sm font-medium">
                    <Check className="size-4" />
                    {t("Done")}
                  </span>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Progress value={(task.current / task.target) * 100} className="h-1.5" />
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {task.current}/{task.target}
                      </span>
                    </div>
                    <Link
                      href={task.href}
                      aria-label={t("Go: {task}", { task: label })}
                      className="bg-foreground text-background flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
                    >
                      {t("Go")}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The Top Tier Seller rule as a checklist, so a seller can see exactly what's left. */
function TopTierCard({ rewards, t }: { rewards: Rewards; t: Translate }) {
  const { seller, topTier } = rewards;
  const checklist = [
    {
      label: t("{n} completed sales", { n: TOP_TIER_SELLER.sales }),
      now: `${Math.min(seller.sales, TOP_TIER_SELLER.sales)}/${TOP_TIER_SELLER.sales}`,
      ok: seller.sales >= TOP_TIER_SELLER.sales,
    },
    {
      label: t("{n} reviews", { n: TOP_TIER_SELLER.reviews }),
      now: `${Math.min(seller.reviews, TOP_TIER_SELLER.reviews)}/${TOP_TIER_SELLER.reviews}`,
      ok: seller.reviews >= TOP_TIER_SELLER.reviews,
    },
    {
      label: t("{n}+ star rating", { n: TOP_TIER_SELLER.rating }),
      now: seller.rating != null ? seller.rating.toFixed(1) : "—",
      ok: (seller.rating ?? 0) >= TOP_TIER_SELLER.rating,
    },
    { label: t("ID verified"), now: seller.verified ? t("Yes") : t("No"), ok: seller.verified },
  ];
  return (
    <section className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            topTier ? "bg-success text-success-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          <Crown className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 className="font-semibold">{t("Top Tier Seller")}</h2>
          <span className="text-muted-foreground text-xs">
            {t("{done} of {total} done", { done: checklist.filter((c) => c.ok).length, total: checklist.length })}
          </span>
        </div>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {checklist.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                c.ok ? "bg-success text-success-foreground" : "border",
              )}
            >
              {c.ok && <Check className="size-3" />}
            </span>
            <span className={cn("flex-1", c.ok && "text-muted-foreground")}>{c.label}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{c.now}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The user's invite link and its QR code, the same one their shared profit cards carry. */
function InviteCard({ handle, t }: { handle: string; t: Translate }) {
  const url = referralUrl(handle);
  const qr = qrPath(url);
  return (
    <section id="invite" data-tour="invite" className="bg-card flex scroll-mt-24 flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <UserPlus className="size-5" />
        </span>
        <h2 className="font-semibold">{t("Invite friends")}</h2>
      </div>
      <svg
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        className="mx-auto size-40 rounded-xl bg-white p-2"
        shapeRendering="crispEdges"
        aria-label={t("Invite QR code")}
      >
        <path d={qr.d} fill="#000" />
      </svg>
      <p className="text-muted-foreground text-center text-xs">
        {t("Friends who sign up from this link or QR code count as your invites. It's also on every profit card you share.")}
      </p>
      <div className="bg-secondary flex w-full items-center gap-1 rounded-lg pl-3">
        <span className="min-w-0 flex-1 truncate text-xs">{url.replace(/^https?:\/\//, "")}</span>
        <ItemShareButton path={`/?ref=${handle}`} />
      </div>
    </section>
  );
}
