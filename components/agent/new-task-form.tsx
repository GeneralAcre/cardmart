"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_DRAFT, GRADERS, draftBudget, draftProblem, summarizeDraft, type Grader, type TaskDraft } from "@/lib/agent/task";
import { AGENT_TASK_FEE_THB } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { CardNameInput } from "@/components/agent/card-name-input";
import { useStartTask } from "@/components/agent/use-start-task";

const MIN_GRADES = [7, 8, 9, 9.5, 10];
const CARD_COUNTS = [1, 2, 3, 5, 10];

/** A saved card alert (Portfolio → Alerts) the form can start from. */
export interface AlertPreset {
  id: string;
  query: string;
  gradingCompany: Grader | null;
  minGrade: number | null;
  blackLabelOnly: boolean;
  maxPriceThb: number | null;
  trustedOnly: boolean;
}

export function fromAlert(a: AlertPreset): TaskDraft {
  return {
    ...EMPTY_DRAFT,
    query: a.query,
    gradingCompanies: a.gradingCompany ? [a.gradingCompany] : [],
    minGrade: a.minGrade,
    blackLabelOnly: a.blackLabelOnly,
    maxPriceThb: a.maxPriceThb ?? 0,
    trustedSellersOnly: a.trustedOnly,
  };
}

export function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/50",
      )}
    >
      {children}
    </button>
  );
}

/** One setting: a short label on the left, its choices on the right (stacked on phones). */
function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-center">
      <Label htmlFor={htmlFor} className="text-muted-foreground font-normal">
        {label}
      </Label>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const digits = (v: string) => Number(v.replace(/\D/g, ""));
/** The preset choices, plus the current value if it came from the agent chat and isn't one of them. */
const withValue = (presets: number[], value: number | null) =>
  value == null || presets.includes(value) ? presets : [...presets, value].sort((a, b) => a - b);

export function NewTaskForm({
  alerts = [],
  startFrom,
  initial,
  onStarted,
  className,
}: {
  alerts?: AlertPreset[];
  startFrom?: string;
  // A draft to edit, e.g. one put together in the agent chat.
  initial?: TaskDraft;
  // Replaces the toast about the first scan, e.g. so the chat can say it instead.
  onStarted?: (outcome: string) => void;
  className?: string;
}) {
  const t = useT();
  const [o, setO] = useState<TaskDraft>(() => {
    const preset = alerts.find((a) => a.id === startFrom);
    return initial ?? (preset ? fromAlert(preset) : EMPTY_DRAFT);
  });
  const [showNotes, setShowNotes] = useState(Boolean(initial?.notes));
  const { start, starting } = useStartTask((outcome) => {
    setO(EMPTY_DRAFT);
    setShowNotes(false);
    if (onStarted) onStarted(outcome);
    else toast(outcome);
  });

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setO((prev) => ({ ...prev, [key]: value }));
  const budget = draftBudget(o);
  const problem = draftProblem(o);

  return (
    <section className={cn("bg-card flex flex-col gap-5 rounded-xl border p-4 sm:p-6", className)}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Bot className="size-5" /> {t(initial ? "Task details" : "New task")}
      </h2>

      {alerts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">{t("From your alerts:")}</span>
          {alerts.slice(0, 5).map((a) => (
            <Choice key={a.id} active={o.query === a.query} onClick={() => setO(fromAlert(a))}>
              {a.query}
            </Choice>
          ))}
        </div>
      )}

      <CardNameInput
        value={o.query}
        onChange={(name) => set("query", name)}
        onPick={(card) => setO((prev) => ({ ...prev, query: card.name, game: card.game }))}
      />

      <div className="flex flex-col gap-4">
        <Row label={t("Game")}>
          <Choice active={o.game === null} onClick={() => set("game", null)}>{t("Any")}</Choice>
          <Choice active={o.game === "POKEMON"} onClick={() => set("game", "POKEMON")}>Pokémon</Choice>
          <Choice active={o.game === "ONE_PIECE"} onClick={() => set("game", "ONE_PIECE")}>One Piece</Choice>
        </Row>
        <Row label={t("Grader")}>
          <Choice active={o.gradingCompanies.length === 0} onClick={() => set("gradingCompanies", [])}>{t("Any")}</Choice>
          {GRADERS.map((g) => (
            <Choice
              key={g}
              active={o.gradingCompanies.includes(g)}
              onClick={() =>
                set(
                  "gradingCompanies",
                  o.gradingCompanies.includes(g) ? o.gradingCompanies.filter((x) => x !== g) : [...o.gradingCompanies, g],
                )
              }
            >
              {g === "RAW" ? t("Raw") : g}
            </Choice>
          ))}
        </Row>
        <Row label={t("Minimum grade")}>
          <Choice active={o.minGrade === null} onClick={() => set("minGrade", null)}>{t("Any")}</Choice>
          {withValue(MIN_GRADES, o.minGrade).map((g) => (
            <Choice key={g} active={o.minGrade === g} onClick={() => set("minGrade", g)}>
              {g === 10 ? "10" : `${g}+`}
            </Choice>
          ))}
        </Row>
        <Row label={t("Black Label")}>
          <Choice active={!o.blackLabelOnly} onClick={() => set("blackLabelOnly", false)}>{t("Any")}</Choice>
          <Choice active={o.blackLabelOnly} onClick={() => set("blackLabelOnly", true)}>{t("Only")}</Choice>
        </Row>
      </div>

      <div className="flex flex-col gap-4 border-t pt-5">
        <Row label={t("Max price per card")} htmlFor="agent-max">
          <div className="relative w-40">
            <Input
              id="agent-max"
              inputMode="numeric"
              className="pr-12"
              value={o.maxPriceThb ? o.maxPriceThb.toLocaleString() : ""}
              onChange={(e) => set("maxPriceThb", digits(e.target.value))}
              placeholder="20,000"
            />
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">THB</span>
          </div>
        </Row>
        <Row label={t("How many cards")}>
          {withValue(CARD_COUNTS, o.maxCards).map((n) => (
            <Choice key={n} active={o.maxCards === n} onClick={() => set("maxCards", n)}>
              {n}
            </Choice>
          ))}
        </Row>
        {o.maxCards > 1 && (
          <Row label={t("Total budget")} htmlFor="agent-budget">
            <div className="relative w-40">
              <Input
                id="agent-budget"
                inputMode="numeric"
                className="pr-12"
                value={budget ? budget.toLocaleString() : ""}
                onChange={(e) => set("budgetThb", digits(e.target.value))}
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">THB</span>
            </div>
          </Row>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t pt-5">
        <Row label={t("When it finds one")}>
          <Choice active={!o.autoBuy} onClick={() => set("autoBuy", false)}>{t("Ask me first")}</Choice>
          <Choice active={o.autoBuy} onClick={() => set("autoBuy", true)}>{t("Buy automatically")}</Choice>
        </Row>
        <Row label={t("Priced above max")}>
          <Choice active={!o.makeOffers} onClick={() => set("makeOffers", false)}>{t("Skip it")}</Choice>
          <Choice active={o.makeOffers} onClick={() => set("makeOffers", true)}>{t("Send an offer")}</Choice>
        </Row>
        <Row label={t("Sellers")}>
          <Choice active={!o.trustedSellersOnly} onClick={() => set("trustedSellersOnly", false)}>{t("Any")}</Choice>
          <Choice active={o.trustedSellersOnly} onClick={() => set("trustedSellersOnly", true)}>{t("Trusted only")}</Choice>
        </Row>
        <Row label={t("After buying")}>
          <Choice active={o.fulfillment === "VAULT"} onClick={() => set("fulfillment", "VAULT")}>{t("Keep in vault")}</Choice>
          <Choice active={o.fulfillment === "SHIP"} onClick={() => set("fulfillment", "SHIP")}>{t("Ship to me")}</Choice>
        </Row>
        {showNotes ? (
          <Textarea
            rows={2}
            maxLength={300}
            autoFocus
            value={o.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={t("e.g. English cards only, no 1st Edition, centering matters")}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
          >
            + {t("Add a note for the agent")}
          </button>
        )}
      </div>

      <div className="bg-muted/40 flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{problem ? t(problem) : summarizeDraft(o)}</span>
          <span className="text-muted-foreground text-xs">
            {t("{fee} THB to start, paid from your agent wallet", { fee: AGENT_TASK_FEE_THB.toLocaleString() })}
          </span>
        </div>
        <Button className="shrink-0" onClick={() => start(o)} disabled={starting || Boolean(problem)}>
          {starting ? <Loader2 className="animate-spin" /> : <Play />}
          {t("Start agent")}
        </Button>
      </div>
    </section>
  );
}
