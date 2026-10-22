import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { CommunityTabs } from "@/components/community/community-tabs";
import { Progress } from "@/components/ui/progress";
import { LEVELS, getRewards, type RewardTask } from "@/lib/rewards";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

// Community → Rewards: the user's XP and level, and the tasks that earn more.
// Everything is counted from what they've actually done (lib/rewards.ts).
export default async function RewardsPage() {
  const user = await getCurrentUser();
  const [{ xp, level, next, tasks }, t] = await Promise.all([getRewards(user), getT()]);

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
