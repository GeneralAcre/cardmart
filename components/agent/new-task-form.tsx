"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Loader2, Play, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAgentTask, planAgentTask, type AgentTaskInput } from "@/lib/agent-actions";
import { scanAgentMandate } from "@/lib/actions";
import { AGENT_TASK_FEE_THB } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { CardNameInput } from "@/components/agent/card-name-input";

const GRADERS = ["PSA", "BGS", "CGC", "RAW"] as const;
const MIN_GRADES = [7, 8, 9, 9.5, 10];
const CARD_COUNTS = [1, 2, 3, 5, 10];

type Grader = (typeof GRADERS)[number];
type Game = "POKEMON" | "ONE_PIECE";

interface Options {
  query: string;
  game: Game | null;
  gradingCompanies: Grader[];
  minGrade: number | null;
  blackLabelOnly: boolean;
  maxPriceThb: number;
  maxCards: number;
  // null = follow max price × cards.
  budgetThb: number | null;
  trustedSellersOnly: boolean;
  autoBuy: boolean;
  makeOffers: boolean;
  fulfillment: "VAULT" | "SHIP";
  notes: string;
}

const EMPTY: Options = {
  query: "",
  game: null,
  gradingCompanies: [],
  minGrade: null,
  blackLabelOnly: false,
  maxPriceThb: 0,
  maxCards: 1,
  budgetThb: null,
  trustedSellersOnly: false,
  autoBuy: false,
  makeOffers: false,
  fulfillment: "VAULT",
  notes: "",
};

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

function fromAlert(a: AlertPreset): Options {
  return {
    ...EMPTY,
    query: a.query,
    gradingCompanies: a.gradingCompany ? [a.gradingCompany] : [],
    minGrade: a.minGrade,
    blackLabelOnly: a.blackLabelOnly,
    maxPriceThb: a.maxPriceThb ?? 0,
    trustedSellersOnly: a.trustedOnly,
  };
}

const GAME_LABEL: Record<Game, string> = { POKEMON: "Pokémon", ONE_PIECE: "One Piece" };

/** The one-line goal shown on the task card, and the brief the AI judges listings against. */
function summarize(o: Options, budgetThb: number): string {
  const grade = [
    o.gradingCompanies.filter((g) => g !== "RAW").join("/") || null,
    o.minGrade != null ? (o.minGrade === 10 ? "10" : `${o.minGrade}+`) : null,
    o.blackLabelOnly ? "Black Label" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = o.gradingCompanies.length === 1 && o.gradingCompanies[0] === "RAW" ? "raw " : "";
  const game = o.game ? ` (${GAME_LABEL[o.game]})` : "";
  const count = o.maxCards === 1 ? "one" : String(o.maxCards);
  const total = o.maxCards > 1 ? `, ${budgetThb.toLocaleString()} THB in total` : "";
  const offers = o.makeOffers ? ", offering if it's priced higher" : "";
  return `Buy ${count} ${raw}${grade ? `${grade} ` : ""}${o.query.trim()}${game} for up to ${o.maxPriceThb.toLocaleString()} THB each${total}${offers}`;
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
/** The preset choices, plus the current value if it came from "Describe it instead" and isn't one of them. */
const withValue = (presets: number[], value: number | null) =>
  value == null || presets.includes(value) ? presets : [...presets, value].sort((a, b) => a - b);

export function NewTaskForm({ alerts = [], startFrom }: { alerts?: AlertPreset[]; startFrom?: string }) {
  const router = useRouter();
  const t = useT();
  const [o, setO] = useState<Options>(() => {
    const preset = alerts.find((a) => a.id === startFrom);
    return preset ? fromAlert(preset) : EMPTY;
  });
  const [describe, setDescribe] = useState("");
  const [showDescribe, setShowDescribe] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [filling, startFilling] = useTransition();
  const [starting, startStarting] = useTransition();

  const set = <K extends keyof Options>(key: K, value: Options[K]) => setO((prev) => ({ ...prev, [key]: value }));
  const budget = o.budgetThb ?? o.maxPriceThb * o.maxCards;
  const problem =
    o.query.trim().length < 2
      ? t("Enter the card to look for.")
      : !(o.maxPriceThb >= 100)
        ? t("Set a maximum price of at least 100 THB.")
        : budget < o.maxPriceThb
          ? t("The total budget has to cover at least one card at your maximum price.")
          : null;

  function fillFromDescription() {
    startFilling(async () => {
      const res = await planAgentTask(describe);
      if (res.error || !res.plan) {
        toast.error(t(res.error ?? "The agent couldn't plan that. Try again."));
        return;
      }
      const p = res.plan;
      setO((prev) => ({
        ...prev,
        query: p.query,
        game: p.game,
        gradingCompanies: p.gradingCompanies,
        minGrade: p.minGrade,
        blackLabelOnly: p.blackLabelOnly,
        maxPriceThb: p.maxPriceThb ?? 0,
        maxCards: Math.max(p.maxCards, 1),
        budgetThb: p.budgetThb,
        trustedSellersOnly: p.trustedSellersOnly,
      }));
      setShowDescribe(false);
      toast.success(
        p.missing.length
          ? t("Filled in. You still need to set: {missing}", { missing: p.missing.join(", ") })
          : t("Filled in. Check the options below, then start."),
      );
    });
  }

  function start() {
    if (problem) return;
    const summary = summarize(o, budget);
    const notes = o.notes.trim();
    const task: AgentTaskInput = {
      instruction: notes ? `${summary}. ${notes}` : summary,
      summary: summary.slice(0, 200),
      query: o.query.trim(),
      game: o.game,
      gradingCompanies: o.gradingCompanies,
      minGrade: o.minGrade,
      blackLabelOnly: o.blackLabelOnly,
      maxPriceThb: o.maxPriceThb,
      budgetThb: budget,
      maxCards: o.maxCards,
      trustedSellersOnly: o.trustedSellersOnly,
      autoBuy: o.autoBuy,
      makeOffers: o.makeOffers,
      fulfillment: o.fulfillment,
    };
    startStarting(async () => {
      const res = await createAgentTask(task);
      if (res.error || !res.id) {
        toast.error(t(res.error ?? "Couldn't start the agent."));
        return;
      }
      toast.success(t("Agent started. It's checking what's listed now…"));
      setO(EMPTY);
      setDescribe("");
      setShowNotes(false);
      router.refresh();
      const scan = await scanAgentMandate(res.id);
      if (scan.error) toast.error(t(scan.error));
      else if (scan.recorded === 0) toast(t("Nothing matching is listed right now. Your agent will check every new listing."));
      else toast.success(t("Your agent looked at {count} listing(s). See its picks below.", { count: scan.recorded }));
      router.refresh();
    });
  }

  return (
    <section className="bg-card flex flex-col gap-5 rounded-xl border p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Bot className="size-5" /> {t("New task")}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setShowDescribe((v) => !v)}>
          <Sparkles /> {t("Describe it instead")}
        </Button>
      </div>

      {showDescribe && (
        <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
          <Textarea
            rows={2}
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            placeholder={t("e.g. One PSA 10 Charizard ex from 151, up to 20,000 THB, trusted sellers only")}
          />
          <Button size="sm" className="w-fit" onClick={fillFromDescription} disabled={filling || describe.trim().length < 8}>
            {filling ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {filling ? t("Reading your request…") : t("Fill in the options")}
          </Button>
        </div>
      )}

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
          <span className="text-sm font-medium">{problem ?? summarize(o, budget)}</span>
          <span className="text-muted-foreground text-xs">
            {t("{fee} THB to start, paid from your agent wallet", { fee: AGENT_TASK_FEE_THB.toLocaleString() })}
          </span>
        </div>
        <Button className="shrink-0" onClick={start} disabled={starting || Boolean(problem)}>
          {starting ? <Loader2 className="animate-spin" /> : <Play />}
          {t("Start agent")}
        </Button>
      </div>
    </section>
  );
}
