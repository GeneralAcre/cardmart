"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bot, Loader2, Play, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createAgentTask, planAgentTask, type AgentTaskInput } from "@/lib/agent-actions";
import { scanAgentMandate } from "@/lib/actions";
import type { MandatePlan } from "@/lib/agent/ai";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

const EXAMPLES = [
  "One PSA 10 Charizard ex from 151, up to 20,000 THB, trusted sellers only",
  "Any Pikachu graded 9 or higher under 3,000 THB — buy up to 3",
  "A PSA 10 Monkey D. Luffy One Piece card, max 8,000 THB",
];

const GRADERS = ["PSA", "BGS", "CGC", "RAW"] as const;

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/50",
      )}
    >
      {children}
    </button>
  );
}

export function NewTaskForm() {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<MandatePlan | null>(null);
  const [task, setTask] = useState<AgentTaskInput | null>(null);
  const [planning, startPlanning] = useTransition();
  const [starting, startStarting] = useTransition();
  const t = useT();

  function makePlan() {
    startPlanning(async () => {
      const res = await planAgentTask(instruction);
      if (res.error || !res.plan) {
        toast.error(t(res.error ?? "The agent couldn't plan that. Try again."));
        return;
      }
      const p = res.plan;
      setPlan(p);
      const maxPrice = p.maxPriceThb ?? 0;
      setTask({
        instruction,
        summary: p.summary,
        query: p.query,
        game: p.game,
        gradingCompanies: p.gradingCompanies,
        minGrade: p.minGrade,
        blackLabelOnly: p.blackLabelOnly,
        maxPriceThb: maxPrice,
        budgetThb: p.budgetThb ?? maxPrice * Math.max(p.maxCards, 1),
        maxCards: Math.max(p.maxCards, 1),
        trustedSellersOnly: p.trustedSellersOnly,
        autoBuy: false,
        fulfillment: "VAULT",
      });
    });
  }

  function start() {
    if (!task) return;
    startStarting(async () => {
      const res = await createAgentTask(task);
      if (res.error || !res.id) {
        toast.error(t(res.error ?? "Couldn't start the agent."));
        return;
      }
      toast.success(t("Agent started. It's checking what's listed now…"));
      setPlan(null);
      setTask(null);
      setInstruction("");
      router.refresh();
      const scan = await scanAgentMandate(res.id);
      if (scan.error) toast.error(t(scan.error));
      else if (scan.recorded === 0) toast(t("Nothing matching is listed right now. Your agent will check every new listing."));
      else toast.success(t("Your agent looked at {count} listing(s). See its picks below.", { count: scan.recorded }));
      router.refresh();
    });
  }

  const set = <K extends keyof AgentTaskInput>(key: K, value: AgentTaskInput[K]) =>
    setTask((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (!plan || !task) {
    return (
      <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4" /> {t("What should your agent buy?")}
        </div>
        <Textarea
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={t("Describe the card, the grade you want, and the most you'll pay.")}
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setInstruction(ex)}
              className="text-muted-foreground hover:text-foreground hover:border-foreground/40 rounded-lg border px-3 py-1.5 text-left text-xs"
            >
              {ex}
            </button>
          ))}
        </div>
        <Button className="w-fit" onClick={makePlan} disabled={planning || instruction.trim().length < 8}>
          {planning ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {planning ? t("Reading your request…") : t("Plan it")}
        </Button>
      </section>
    );
  }

  const noPrice = !(task.maxPriceThb > 0);

  return (
    <section className="bg-card flex flex-col gap-5 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t("Your agent's plan — check the limits, then start it")}</span>
        <p className="font-semibold">{plan.summary}</p>
        {plan.missing.length > 0 && (
          <p className="text-destructive text-xs">
            {t("You didn't say:")} {plan.missing.join(", ")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="q">{t("Card to look for")}</Label>
          <Input id="q" value={task.query} onChange={(e) => set("query", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("Grader")}</Label>
          <div className="flex flex-wrap gap-2">
            <Choice active={task.gradingCompanies?.length === 0} onClick={() => set("gradingCompanies", [])}>
              {t("Any")}
            </Choice>
            {GRADERS.map((g) => (
              <Choice
                key={g}
                active={task.gradingCompanies?.includes(g) ?? false}
                onClick={() =>
                  set(
                    "gradingCompanies",
                    task.gradingCompanies?.includes(g)
                      ? task.gradingCompanies.filter((x) => x !== g)
                      : [...(task.gradingCompanies ?? []), g],
                  )
                }
              >
                {g === "RAW" ? t("Raw") : g}
              </Choice>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grade">{t("Minimum grade")}</Label>
          <Input
            id="grade"
            inputMode="decimal"
            placeholder={t("Any")}
            value={task.minGrade ?? ""}
            onChange={(e) => set("minGrade", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="max">{t("Max price per card (THB)")}</Label>
          <Input
            id="max"
            inputMode="numeric"
            className={cn(noPrice && "border-destructive")}
            value={task.maxPriceThb || ""}
            onChange={(e) => set("maxPriceThb", Number(e.target.value.replace(/\D/g, "")))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget">{t("Total budget (THB)")}</Label>
          <Input
            id="budget"
            inputMode="numeric"
            value={task.budgetThb || ""}
            onChange={(e) => set("budgetThb", Number(e.target.value.replace(/\D/g, "")))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cards">{t("Cards to buy")}</Label>
          <Input
            id="cards"
            inputMode="numeric"
            value={task.maxCards ?? 1}
            onChange={(e) => set("maxCards", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("When it buys")}</Label>
          <div className="flex flex-wrap gap-2">
            <Choice active={task.fulfillment === "VAULT"} onClick={() => set("fulfillment", "VAULT")}>
              {t("Keep in vault")}
            </Choice>
            <Choice active={task.fulfillment === "SHIP"} onClick={() => set("fulfillment", "SHIP")}>
              {t("Ship to me")}
            </Choice>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={task.trustedSellersOnly} onCheckedChange={(v) => set("trustedSellersOnly", v === true)} />
          <span>{t("Only buy from ID-verified or 4★+ sellers")}</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={task.autoBuy} onCheckedChange={(v) => set("autoBuy", v === true)} />
          <span className="flex flex-col">
            <span>{t("Buy automatically")}</span>
            <span className="text-muted-foreground text-xs">
              {task.autoBuy
                ? t("The agent pays from its wallet as soon as it finds a good match — no need to approve each one.")
                : t("Off: the agent asks you first, and you approve each purchase with one tap.")}
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={starting || noPrice}>
          {starting ? <Loader2 className="animate-spin" /> : <Play />}
          {t("Start agent")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setPlan(null);
            setTask(null);
          }}
        >
          <ArrowLeft /> {t("Back")}
        </Button>
      </div>
    </section>
  );
}
