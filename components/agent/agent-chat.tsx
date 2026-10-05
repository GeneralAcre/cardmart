"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Bot, ListChecks, Loader2, Pencil, Play, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { agentChat, type MarketSnapshot } from "@/lib/agent-actions";
import { draftProblem, summarizeDraft, type TaskDraft } from "@/lib/agent/task";
import { AGENT_TASK_FEE_THB } from "@/lib/pricing";
import { formatGrade, formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";
import { Choice, NewTaskForm, fromAlert, type AlertPreset } from "@/components/agent/new-task-form";
import { useStartTask } from "@/components/agent/use-start-task";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
  market?: MarketSnapshot | null;
  showTask?: boolean;
  // Written here, not by the AI (greetings, "task started"), so it isn't sent back to it.
  local?: boolean;
}

// The AI sees the latest messages only; the draft and context carry the rest.
const HISTORY_SENT = 20;

const newId = () => Math.random().toString(36).slice(2);

function gradeLabel(c: { gradingCompany: string; grade: number | null; isBlackLabel: boolean }, raw: string) {
  return c.gradingCompany === "RAW" ? raw : `${c.gradingCompany} ${formatGrade(c.grade)}${c.isBlackLabel ? " BL" : ""}`;
}

/** What the card being discussed sells for on CardMart right now, with the cheapest listings. */
function MarketCard({ market }: { market: MarketSnapshot }) {
  const t = useT();
  return (
    <div className="bg-background/60 flex flex-col gap-2 rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          {market.forSale > 0
            ? t("{count} for sale · from {price}", { count: market.forSale, price: formatThb(market.lowestThb!) })
            : t("None for sale now")}
        </span>
        {market.medianSaleThb != null && (
          <span className="text-muted-foreground">
            {t("Sold for {price} (median of {count})", { price: formatThb(market.medianSaleThb), count: market.recentSales })}
          </span>
        )}
      </div>
      {market.cheapest.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-3">
          {market.cheapest.map((c) => (
            <Link
              key={c.id}
              href={`/item/${c.id}`}
              className="hover:bg-muted flex items-center gap-2 rounded-lg border p-1.5 transition-colors"
            >
              <div className="bg-muted relative aspect-[3/4] w-8 shrink-0 overflow-hidden rounded">
                {c.imageUrl && <Image src={c.imageUrl} alt={c.name} fill sizes="32px" className="object-cover" />}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium">{c.name}</span>
                <span className="text-muted-foreground truncate text-[11px]">
                  {gradeLabel(c, t("Raw"))} · {formatThb(c.priceThb)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The task the chat has put together, ready to start — the main settings can be flipped right here. */
function TaskCard({
  draft,
  onChange,
  onEdit,
  onStart,
  starting,
}: {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  onEdit: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const t = useT();
  const problem = draftProblem(draft);
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => onChange({ ...draft, [key]: value });
  return (
    <div className="bg-background flex flex-col gap-3 rounded-xl border p-3 sm:p-4">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ListChecks className="size-3.5" /> {t("Your task")}
      </span>
      <p className="font-medium">{problem ? t(problem) : summarizeDraft(draft)}</p>
      <div className="flex flex-wrap gap-2">
        <Choice active={!draft.autoBuy} onClick={() => set("autoBuy", false)}>{t("Ask me first")}</Choice>
        <Choice active={draft.autoBuy} onClick={() => set("autoBuy", true)}>{t("Buy automatically")}</Choice>
      </div>
      <div className="flex flex-wrap gap-2">
        <Choice active={draft.trustedSellersOnly} onClick={() => set("trustedSellersOnly", !draft.trustedSellersOnly)}>
          {t("Trusted sellers only")}
        </Choice>
        <Choice active={draft.makeOffers} onClick={() => set("makeOffers", !draft.makeOffers)}>
          {t("Send offers above max")}
        </Choice>
        <Choice
          active={draft.fulfillment === "SHIP"}
          onClick={() => set("fulfillment", draft.fulfillment === "SHIP" ? "VAULT" : "SHIP")}
        >
          {t("Ship to me")}
        </Choice>
      </div>
      {draft.notes && <p className="text-muted-foreground text-xs">{t("Note: {note}", { note: draft.notes })}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" onClick={onStart} disabled={starting || Boolean(problem)}>
          {starting ? <Loader2 className="animate-spin" /> : <Play />}
          {t("Start agent")}
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil /> {t("Edit details")}
        </Button>
        <span className="text-muted-foreground text-xs">
          {t("{fee} THB to start, paid from your agent wallet", { fee: AGENT_TASK_FEE_THB.toLocaleString() })}
        </span>
      </div>
    </div>
  );
}

/**
 * The buying agent as a chat: the user talks (or taps a suggested reply), the
 * AI answers and builds up a task, and a task card in the thread starts it.
 * The task form is still there behind "Use the form" and "Edit details".
 */
export function AgentChat({ alerts = [], startFrom }: { alerts?: AlertPreset[]; startFrom?: string }) {
  const t = useT();
  const alert = alerts.find((a) => a.id === startFrom);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "hello",
      role: "assistant",
      local: true,
      content: alert
        ? t("Let's hunt for {card}. Here's a task from your alert — change anything, or just tell me.", { card: alert.query })
        : t("Hi! I'm your buying agent. Tell me which card you're hunting for, or ask me anything about buying on CardMart."),
      showTask: Boolean(alert),
    },
  ]);
  const [draft, setDraft] = useState<TaskDraft | null>(alert ? fromAlert(alert) : null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [useForm, setUseForm] = useState(false);
  const [thinking, startThinking] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const say = (content: string) =>
    setMessages((prev) => [...prev, { id: newId(), role: "assistant", content, local: true }]);
  const started = (outcome: string) => {
    setDraft(null);
    setEditing(false);
    say(`${t("Done — I'm on it.")} ${outcome}`);
  };
  const { start, starting } = useStartTask(started);

  // Keep the newest message in view (inside the thread, without scrolling the page).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function send(raw: string) {
    const content = raw.trim();
    if (!content || thinking) return;
    const mine: Message = { id: newId(), role: "user", content };
    const next = [...messages, mine];
    setMessages(next);
    setText("");
    startThinking(async () => {
      const history = next
        .filter((m) => !m.local)
        .slice(-HISTORY_SENT)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
      const res = await agentChat({ history, draft });
      if (res.error || !res.reply) {
        toast.error(t(res.error ?? "The agent couldn't answer. Try again."));
        setMessages((prev) => prev.filter((m) => m.id !== mine.id));
        setText(content);
        return;
      }
      setDraft(res.draft ?? null);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: res.reply!,
          quickReplies: res.quickReplies,
          market: res.market,
          showTask: res.showTask,
        },
      ]);
    });
  }

  function reset() {
    setMessages([{ id: newId(), role: "assistant", local: true, content: t("Fresh start. What are you hunting for?") }]);
    setDraft(null);
  }

  const last = messages.at(-1);
  // The task card sits under the newest message that showed it, as long as there's a draft.
  const taskAt = draft ? [...messages].reverse().find((m) => m.showTask)?.id : undefined;
  const starters =
    messages.length === 1 && !alert
      ? [
          ...alerts.slice(0, 3).map((a) => t("Hunt for my alert: {card}", { card: a.query })),
          t("Find me a PSA 10 Charizard"),
          t("What can you do?"),
          t("How do fees work?"),
        ]
      : [];
  const chips = thinking
    ? []
    : [...new Set(last?.role === "assistant" && last.quickReplies?.length ? last.quickReplies : starters)];

  if (useForm) {
    return (
      <div className="flex flex-col gap-2">
        <NewTaskForm alerts={alerts} startFrom={startFrom} initial={draft ?? undefined} />
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setUseForm(false)}>
          <Bot /> {t("Back to the chat")}
        </Button>
      </div>
    );
  }

  return (
    <section className="bg-card flex flex-col rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Bot className="size-5" /> {t("Chat with your agent")}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setUseForm(true)}>
            <ListChecks /> {t("Use the form")}
          </Button>
          {messages.length > 1 && (
            <Button variant="ghost" size="icon" className="size-8" onClick={reset} aria-label={t("Start over")} title={t("Start over")}>
              <RotateCcw />
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex max-h-[34rem] min-h-72 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        {messages.map((m) =>
          m.role === "user" ? (
            <p
              key={m.id}
              className="bg-foreground text-background max-w-[85%] self-end rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap"
            >
              {m.content}
            </p>
          ) : (
            <div key={m.id} className="flex max-w-[92%] gap-2.5 self-start">
              <span className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                <Bot className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <p className="bg-muted/60 rounded-2xl rounded-tl-md px-3.5 py-2 text-sm whitespace-pre-wrap">{m.content}</p>
                {m.market && <MarketCard market={m.market} />}
                {m.id === taskAt && draft && (
                  <TaskCard
                    draft={draft}
                    onChange={setDraft}
                    onEdit={() => setEditing(true)}
                    onStart={() => start(draft)}
                    starting={starting}
                  />
                )}
              </div>
            </div>
          ),
        )}
        {thinking && (
          <div className="text-muted-foreground flex items-center gap-2.5 self-start text-sm">
            <span className="bg-muted flex size-7 items-center justify-center rounded-full">
              <Bot className="size-4" />
            </span>
            <Loader2 className="size-4 animate-spin" /> {t("Thinking…")}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:px-5">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Choice key={c} active={false} onClick={() => send(c)}>
                {c}
              </Choice>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <Textarea
            rows={1}
            maxLength={1200}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a new line; leave Thai/IME composition alone.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={t("e.g. One PSA 10 Charizard ex from 151, up to 20,000 THB")}
            aria-label={t("Message your agent")}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon" disabled={thinking || !text.trim()} aria-label={t("Send")}>
            <Send />
          </Button>
        </form>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">{t("Edit details")}</DialogTitle>
          </DialogHeader>
          {draft && <NewTaskForm initial={draft} onStarted={started} className="border-0 p-0 sm:p-0" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
