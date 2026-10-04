"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pause, Play, Radar, ShoppingCart, Sparkles, Square, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { approveAgentDecision, declineAgentDecision, scanAgentMandate } from "@/lib/actions";
import { setAgentTaskStatus } from "@/lib/agent-actions";
import { formatDateTime, formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

export interface AgentTaskRow {
  id: string;
  summary: string;
  status: "ACTIVE" | "PAUSED" | "DONE";
  maxPriceThb: number;
  budgetThb: number;
  spentThb: number;
  maxCards: number;
  boughtCount: number;
  autoBuy: boolean;
  trustedSellersOnly: boolean;
  lastScannedAt: string | null;
  decisionCount: number;
  report: {
    reviewed: number;
    matched: number;
    bought: number;
    waiting: number;
    savedThb: number;
    best: { name: string; priceThb: number; fairValueThb: number; pctUnder: number } | null;
  };
}

export interface AgentDecisionRow {
  id: string;
  status: "PROPOSED" | "OFFERED" | "EXECUTED" | "SKIPPED" | "DECLINED" | "FAILED";
  priceThb: number;
  // What the agent offered, when the listing was priced above the task's max.
  offerThb: number | null;
  fairValueThb: number | null;
  confidence: string | null;
  reasoning: string;
  error: string | null;
  createdAt: string;
  taskSummary: string;
  asset: { id: string; name: string; gradingCompany: string; grade: number | null; isBlackLabel: boolean; imageUrl: string | null };
}

const STATUS_BADGE: Record<AgentTaskRow["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  ACTIVE: { label: "Watching", variant: "default" },
  PAUSED: { label: "Paused", variant: "secondary" },
  DONE: { label: "Done", variant: "outline" },
};

// The task's results so far: a funnel (reviewed → right card → bought) and
// its best find, so the user sees what the agent did without reading the feed.
function TaskReport({ report }: { report: AgentTaskRow["report"] }) {
  const t = useT();
  if (report.reviewed === 0) {
    return <p className="text-muted-foreground text-xs">{t("No listings reviewed yet. New listings that fit are checked as they appear.")}</p>;
  }
  const steps = [
    { label: t("Reviewed"), value: report.reviewed },
    { label: t("Right card"), value: report.matched },
    { label: t("Bought"), value: report.bought },
  ];
  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-lg p-3">
      <div className="grid grid-cols-3 gap-2">
        {steps.map((s) => (
          <div key={s.label} className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{s.value}</span>
            <span className="text-muted-foreground text-[11px]">{s.label}</span>
          </div>
        ))}
      </div>
      {report.best && report.best.pctUnder > 0 && (
        <p className="flex items-start gap-1.5 text-xs">
          <Sparkles className="text-success mt-px size-3.5 shrink-0" />
          <span>
            {t("Best find: {name} at {price}, {pct}% under fair value.", {
              name: report.best.name,
              price: formatThb(report.best.priceThb),
              pct: report.best.pctUnder,
            })}
          </span>
        </p>
      )}
      {report.savedThb > 0 && (
        <p className="text-success text-xs font-medium">
          {t("Saved {amount} against fair value.", { amount: formatThb(report.savedThb) })}
        </p>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: AgentTaskRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useT();

  function act(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  }

  const badge = STATUS_BADGE[task.status];
  return (
    <article className={cn("bg-card flex flex-col gap-4 rounded-xl border p-4", task.status === "ACTIVE" && "border-highlight/50")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{task.summary}</p>
        <Badge variant={badge.variant} className="shrink-0">
          {task.status === "ACTIVE" && <span className="bg-highlight-foreground size-1.5 animate-pulse rounded-full" />}
          {t(badge.label)}
        </Badge>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("Max / card")}</dt>
          <dd className="font-medium">{formatThb(task.maxPriceThb)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Cards")}</dt>
          <dd className="font-medium tabular-nums">
            {task.boughtCount} / {task.maxCards}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Mode")}</dt>
          <dd className="font-medium">{task.autoBuy ? t("Auto-buy") : t("Ask me first")}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1">
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{t("Budget used")}</span>
          <span className="tabular-nums">
            {formatThb(task.spentThb)} / {formatThb(task.budgetThb)}
          </span>
        </div>
        <Progress value={Math.min(100, (task.spentThb / task.budgetThb) * 100)} />
      </div>

      <TaskReport report={task.report} />

      <div className="flex flex-wrap items-center gap-2">
        {task.status === "ACTIVE" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              act("scan", async () => {
                const res = await scanAgentMandate(task.id);
                if (res.error) toast.error(t(res.error));
                else if (res.recorded === 0) toast(t("No new matching listings since the last check."));
                else toast.success(t("Your agent looked at {count} listing(s).", { count: res.recorded }));
              })
            }
          >
            {busy === "scan" ? <Loader2 className="animate-spin" /> : <Radar />}
            {busy === "scan" ? t("Checking listings…") : t("Scan now")}
          </Button>
        )}
        {task.status === "ACTIVE" && (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act("pause", () => setAgentTaskStatus(task.id, "PAUSED"))}>
            <Pause /> {t("Pause")}
          </Button>
        )}
        {task.status === "PAUSED" && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("resume", () => setAgentTaskStatus(task.id, "ACTIVE"))}>
            <Play /> {t("Resume")}
          </Button>
        )}
        {task.status !== "DONE" && (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act("stop", () => setAgentTaskStatus(task.id, "DONE"))}>
            <Square /> {t("Stop")}
          </Button>
        )}
        {task.lastScannedAt && (
          <span className="text-muted-foreground ml-auto text-[11px]">
            {t("Last checked {date}", { date: formatDateTime(task.lastScannedAt) })}
          </span>
        )}
      </div>
    </article>
  );
}

export function AgentTaskList({ tasks }: { tasks: AgentTaskRow[] }) {
  const t = useT();
  if (tasks.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("Your agent's tasks")}</h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

const DECISION_BADGE: Record<AgentDecisionRow["status"], { label: string; className: string }> = {
  PROPOSED: { label: "Needs your OK", className: "bg-highlight text-highlight-foreground border-0" },
  OFFERED: { label: "Offer sent", className: "bg-muted border-0" },
  EXECUTED: { label: "Bought", className: "bg-success/15 text-success border-0" },
  SKIPPED: { label: "Passed", className: "" },
  DECLINED: { label: "You declined", className: "" },
  FAILED: { label: "Couldn't buy", className: "bg-destructive/15 text-destructive border-0" },
};

/** How far the price is under (positive) or over (negative) the agent's fair value, in percent. */
function dealPct(d: AgentDecisionRow): number | null {
  const paying = d.offerThb ?? d.priceThb;
  return d.fairValueThb != null && d.fairValueThb > 0 ? Math.round(((d.fairValueThb - paying) / d.fairValueThb) * 100) : null;
}

function gradeLabel(asset: AgentDecisionRow["asset"], raw: string) {
  return asset.gradingCompany === "RAW" ? raw : `${asset.gradingCompany} ${formatGrade(asset.grade)}`;
}

function useDecisionActions(id: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [, startTransition] = useTransition();
  const t = useT();

  function approve() {
    setBusy("approve");
    startTransition(async () => {
      const res = await approveAgentDecision(id);
      if (res.error) toast.error(t(res.error));
      else toast.success(t("Bought! Your agent paid from its wallet."));
      setBusy(null);
      router.refresh();
    });
  }

  function decline() {
    setBusy("decline");
    startTransition(async () => {
      await declineAgentDecision(id);
      setBusy(null);
      router.refresh();
    });
  }

  return { busy, approve, decline };
}

// A pick waiting for the user's OK, laid out like a marketplace deal: the
// card up front, the discount against fair value as the headline number.
function DealCard({ d }: { d: AgentDecisionRow }) {
  const t = useT();
  const { busy, approve, decline } = useDecisionActions(d.id);
  const deal = dealPct(d);

  return (
    <article className="bg-card hover:border-foreground/30 flex flex-col overflow-hidden rounded-xl border transition-colors">
      <Link href={`/item/${d.asset.id}`} className="bg-muted relative block aspect-[4/5]">
        {d.asset.imageUrl && (
          <Image src={d.asset.imageUrl} alt={d.asset.name} fill sizes="(min-width: 1024px) 18rem, 50vw" className="object-contain p-3" />
        )}
        {deal != null && deal > 0 && (
          <span className="bg-success text-success-foreground absolute top-2 left-2 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums">
            -{deal}%
          </span>
        )}
        <span className="bg-background/85 absolute top-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
          {gradeLabel(d.asset, t("Raw"))}
          {d.asset.isBlackLabel ? " BL" : ""}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/item/${d.asset.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">
          {d.asset.name}
        </Link>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums">{formatThb(d.priceThb)}</span>
          {d.fairValueThb != null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("Fair {price}", { price: formatThb(d.fairValueThb) })}
            </span>
          )}
        </div>
        <p className="text-muted-foreground line-clamp-3 text-xs">{d.reasoning}</p>
        {d.confidence && (
          <span className="text-muted-foreground text-[11px]">{t("{level} confidence", { level: t(d.confidence) })}</span>
        )}
        <div className="mt-auto flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={approve} disabled={busy !== null}>
            {busy === "approve" ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
            {t("Approve & buy")}
          </Button>
          <Button size="sm" variant="ghost" onClick={decline} disabled={busy !== null} aria-label={t("Decline")}>
            <X />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function AgentDeals({ decisions }: { decisions: AgentDecisionRow[] }) {
  const t = useT();
  const proposed = decisions.filter((d) => d.status === "PROPOSED");
  if (proposed.length === 0) return null;
  return (
    <section id="waiting" className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="bg-highlight size-2 animate-pulse rounded-full" />
        <h2 className="text-sm font-semibold">{t("Waiting for your OK")}</h2>
        <span className="text-muted-foreground text-xs">{proposed.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {proposed.map((d) => (
          <DealCard key={d.id} d={d} />
        ))}
      </div>
    </section>
  );
}

function DecisionCard({ d }: { d: AgentDecisionRow }) {
  const t = useT();
  const badge = DECISION_BADGE[d.status];
  const deal = dealPct(d);

  return (
    <li className={cn("flex gap-3 p-4", (d.status === "SKIPPED" || d.status === "DECLINED") && "opacity-70")}>
      <Link href={`/item/${d.asset.id}`} className="bg-muted relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-md">
        {d.asset.imageUrl && <Image src={d.asset.imageUrl} alt={d.asset.name} fill sizes="56px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <Link href={`/item/${d.asset.id}`} className="truncate text-sm font-semibold hover:underline">
              {d.asset.name}
            </Link>
            <span className="text-muted-foreground text-xs">
              {gradeLabel(d.asset, t("Raw"))}
              {d.asset.isBlackLabel ? " · Black Label" : ""} ·{" "}
              {d.offerThb != null
                ? t("offered {offer} (asking {price})", { offer: formatThb(d.offerThb), price: formatThb(d.priceThb) })
                : formatThb(d.priceThb)}
              {deal != null && (
                <span className={cn("ml-1", deal >= 0 ? "text-success" : "text-destructive")}>
                  ({deal >= 0 ? t("{pct}% under fair value", { pct: deal }) : t("{pct}% over fair value", { pct: -deal })})
                </span>
              )}
            </span>
          </div>
          <Badge variant="outline" className={badge.className}>
            {t(badge.label)}
          </Badge>
        </div>
        <p className="text-sm">{d.reasoning}</p>
        {d.error && <p className="text-destructive text-xs">{d.error}</p>}
        <span className="text-muted-foreground text-[11px]">
          {d.taskSummary} · {formatDateTime(d.createdAt)}
          {d.confidence ? ` · ${t("{level} confidence", { level: t(d.confidence) })}` : ""}
        </span>
        {d.status === "EXECUTED" && (
          <span className="text-success flex items-center gap-1 text-xs">
            <Check className="size-3" /> {t("Paid into escrow from your agent wallet")}
          </span>
        )}
      </div>
    </li>
  );
}

// Everything the agent decided, apart from picks still waiting for an OK
// (those are the deal cards in AgentDeals).
export function AgentActivity({ decisions: all }: { decisions: AgentDecisionRow[] }) {
  const t = useT();
  const [showPassed, setShowPassed] = useState(false);
  const decisions = all.filter((d) => d.status !== "PROPOSED");
  const visible = showPassed ? decisions : decisions.filter((d) => d.status !== "SKIPPED");
  const passed = decisions.length - decisions.filter((d) => d.status !== "SKIPPED").length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("What your agent did")}</h2>
        {passed > 0 && (
          <button type="button" onClick={() => setShowPassed((v) => !v)} className="text-muted-foreground hover:text-foreground text-xs">
            {showPassed ? t("Hide passed listings") : t("Show {count} passed listing(s)", { count: passed })}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {decisions.length === 0
            ? t("Nothing yet. Your agent checks every new listing that fits a task, and explains each call here.")
            : t("Your agent passed on everything so far. Show passed listings to see why.")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {visible.map((d) => (
            <DecisionCard key={d.id} d={d} />
          ))}
        </ul>
      )}
    </section>
  );
}
