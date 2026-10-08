"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, Check, Gavel, Lock, Search, ShieldCheck, Timer, TrendingUp } from "lucide-react";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useLanguage } from "@/components/landing/language-provider";
import { formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Feature rows: copy on one side, a mock of the real screen on the other,
// alternating sides on wide screens.

function FeatureRow({
  index,
  eyebrow,
  title,
  description,
  points,
  reverse,
  children,
}: {
  index: number;
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <div className={cn("flex flex-col", reverse && "lg:order-2")}>
        <span className="text-highlight flex items-center gap-3 font-mono text-xs font-medium tracking-wider uppercase">
          <span className="text-muted-foreground">0{index}</span>
          <span className="bg-highlight/40 h-px w-8" />
          {eyebrow}
        </span>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h3>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed sm:text-base">{description}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-sm">
              <span className="bg-highlight/10 text-highlight ring-highlight/20 flex size-5 shrink-0 items-center justify-center rounded-full ring-1">
                <Check className="size-3" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("relative min-w-0", reverse && "lg:order-1")}>
        <div aria-hidden className="bg-highlight/10 absolute inset-8 -z-10 rounded-full blur-3xl" />
        {children}
      </div>
    </motion.div>
  );
}

function MockFrame({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="bg-card/80 overflow-hidden rounded-2xl border shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Icon className="text-muted-foreground size-4 shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        <span className="text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-[10px]">{t.showcase.sample}</span>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 01 · Market data: a price chart with a range switch and a grade ladder.

const DAY = 86_400_000;
// Fixed "today" so server and client draw the same sample chart.
const SAMPLE_END = Date.UTC(2026, 9, 1);

// A seeded random walk ending at the current price: same line every render.
const SAMPLE_HISTORY = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const points: { t: number; price: number }[] = [];
  let price = 18_500;
  for (let i = 0; i < 365; i += 3) {
    points.push({ t: SAMPLE_END - i * DAY, price: Math.round(price / 50) * 50 });
    // Walking backwards in time, so drift down on average: the card has been climbing.
    price *= 1 - 0.006 + (rand() - 0.5) * 0.05;
  }
  return points.reverse();
})();

const RANGES = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
] as const;

const GRADE_PRICES = [
  { label: "Raw", price: 4_200 },
  { label: "PSA 9", price: 7_900 },
  { label: "PSA 10", price: 18_500, current: true },
  { label: "BGS 10 BL", price: 31_000 },
];

const chartConfig = { price: { label: "Price", color: "var(--success)" } } satisfies ChartConfig;

function MarketMock() {
  const { t, locale } = useLanguage();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("90d");
  const days = RANGES.find((r) => r.key === range)!.days;
  const points = SAMPLE_HISTORY.filter((p) => p.t >= SAMPLE_END - days * DAY);
  const first = points[0].price;
  const latest = points.at(-1)!.price;
  const changePct = ((latest - first) / first) * 100;
  const maxGrade = Math.max(...GRADE_PRICES.map((g) => g.price));
  const dateLocale = locale === "th" ? "th-TH" : "en-US";

  return (
    <MockFrame title="Charizard ex · PSA 10" icon={TrendingUp}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs">{t.showcase.market.chartLabel}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatThb(latest)}</p>
            <p className={cn("text-xs font-semibold tabular-nums", changePct >= 0 ? "text-success" : "text-destructive")}>
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(1)}% {t.showcase.market.inRange}
            </p>
          </div>
          <div className="bg-secondary/60 flex gap-1 rounded-lg border p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  range === r.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[180px] w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[var(--color-price)]"
        >
          <AreaChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="landingFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
            <YAxis dataKey="price" domain={["dataMin - 500", "dataMax + 500"]} hide />
            <Tooltip
              cursor={{ strokeDasharray: "4 4", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = active ? payload?.[0]?.payload : null;
                if (!p) return null;
                return (
                  <div className="bg-background/95 rounded-lg border px-3 py-2 shadow-lg">
                    <p className="text-muted-foreground text-[11px]">
                      {new Date(p.t).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-sm font-bold tabular-nums">{formatThb(p.price)}</p>
                  </div>
                );
              }}
            />
            <Area
              dataKey="price"
              type="monotone"
              fill="url(#landingFill)"
              stroke="var(--color-price)"
              strokeWidth={2}
              animationDuration={600}
              activeDot={{ r: 5, strokeWidth: 2, fill: "var(--background)", stroke: "var(--color-price)" }}
            />
          </AreaChart>
        </ChartContainer>

        <div className="border-t pt-4">
          <p className="text-muted-foreground mb-3 text-xs">{t.showcase.market.gradeTitle}</p>
          <div className="flex flex-col gap-2">
            {GRADE_PRICES.map((g) => (
              <div key={g.label} className="grid grid-cols-[72px_1fr_88px] items-center gap-3 text-xs">
                <span className={cn("font-mono", g.current ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  {g.label}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(g.price / maxGrade) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn("h-full rounded-full", g.current ? "bg-success" : "bg-white/25")}
                  />
                </div>
                <span className="text-right font-semibold tabular-nums">{formatThb(g.price)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

// ---------------------------------------------------------------------------
// 02 · Escrow: the buyer's order tracker, mid-inspection.

function EscrowMock() {
  const { t } = useLanguage();
  const e = t.showcase.escrow;
  const CURRENT = 2;

  return (
    <MockFrame title={e.orderTitle} icon={ShieldCheck}>
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="border-highlight/20 bg-highlight/5 flex items-center justify-between gap-3 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-highlight/15 text-highlight flex size-10 items-center justify-center rounded-lg">
              <Lock className="size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{e.held}</p>
              <p className="text-lg font-semibold tabular-nums">{formatThb(12_900)}</p>
            </div>
          </div>
          <span className="text-muted-foreground font-mono text-[11px]">7xKX…9fQp</span>
        </div>

        <ol className="flex flex-col">
          {e.steps.map((step, i) => {
            const state = i < CURRENT ? "done" : i === CURRENT ? "current" : "todo";
            return (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                {i < e.steps.length - 1 && (
                  <span
                    aria-hidden
                    className={cn("absolute top-7 bottom-1 left-[11px] w-px", state === "done" ? "bg-success/60" : "bg-white/10")}
                  />
                )}
                <span
                  className={cn(
                    "relative flex size-6 shrink-0 items-center justify-center rounded-full border",
                    state === "done" && "bg-success border-success text-success-foreground",
                    state === "current" && "border-success",
                    state === "todo" && "border-white/15",
                  )}
                >
                  {state === "done" && <Check className="size-3.5" />}
                  {state === "current" && (
                    <>
                      <span className="bg-success size-2 rounded-full" />
                      <span className="border-success absolute inset-0 animate-ping rounded-full border opacity-50 motion-reduce:hidden" />
                    </>
                  )}
                </span>
                <div className="flex flex-col pt-0.5">
                  <span className={cn("text-sm font-medium", state === "todo" && "text-muted-foreground")}>{step}</span>
                  <span className="text-muted-foreground text-xs">{e.stepDetails[i]}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </MockFrame>
  );
}

// ---------------------------------------------------------------------------
// 03 · Auction: a ticking clock and bids that keep arriving.

const BIDDERS = ["kanto_collector", "mew2k", "pika.th", "gengar_vault", "slabhunter", "ash.bkk"];
const INITIAL_BIDS = [
  { id: 3, who: "mew2k", amount: 9_400, ago: "12s" },
  { id: 2, who: "kanto_collector", amount: 9_200, ago: "48s" },
  { id: 1, who: "pika.th", amount: 8_800, ago: "2m" },
];

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function AuctionMock() {
  const { t } = useLanguage();
  const a = t.showcase.auction;
  const [seconds, setSeconds] = useState(2 * 3600 + 14 * 60 + 37);
  const [bids, setBids] = useState(INITIAL_BIDS);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const clock = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    const bidder = setInterval(() => {
      setBids((prev) => {
        const top = prev[0];
        const who = BIDDERS.filter((b) => b !== top.who)[top.id % (BIDDERS.length - 1)];
        return [{ id: top.id + 1, who, amount: top.amount + 200, ago: "now" }, ...prev].slice(0, 3);
      });
    }, 4500);
    return () => {
      clearInterval(clock);
      clearInterval(bidder);
    };
  }, []);

  return (
    <MockFrame title="Luffy Gear 5 · PSA 10" icon={Gavel}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="bg-destructive size-1.5 animate-pulse rounded-full" />
              {a.currentBid}
            </p>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={bids[0].amount}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className="mt-1 text-xl font-semibold tabular-nums"
              >
                {formatThb(bids[0].amount)}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Timer className="size-3" />
              {a.endsIn}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatClock(seconds)}</p>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-2 text-xs">{a.bids}</p>
          <ul className="flex flex-col gap-1.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {bids.map((bid, i) => (
                <motion.li
                  key={bid.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                    i === 0 ? "bg-success/10 ring-success/30 ring-1" : "bg-white/[0.03]",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="bg-secondary flex size-6 items-center justify-center rounded-full text-[10px] font-semibold uppercase">
                      {bid.who[0]}
                    </span>
                    <span className="font-medium">@{bid.who}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{bid.ago}</span>
                    <span className="font-semibold tabular-nums">{formatThb(bid.amount)}</span>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <div aria-hidden className="bg-foreground text-background rounded-full py-2.5 text-center text-sm font-semibold">
          {a.placeBid} · {formatThb(bids[0].amount + 200)}
        </div>
      </div>
    </MockFrame>
  );
}

// ---------------------------------------------------------------------------
// 04 · Buying agent: a request, the agent's work, and a match to approve.

function AgentMock() {
  const { t } = useLanguage();
  const g = t.showcase.agent;
  const bubble = {
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
  };

  return (
    <MockFrame title={g.eyebrow} icon={Bot}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <motion.div {...bubble} transition={{ delay: 0.1 }} className="bg-secondary ml-auto max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
          {g.you}
        </motion.div>

        <motion.div
          {...bubble}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          <Search className="size-3.5" />
          {g.working}
        </motion.div>

        <motion.div {...bubble} transition={{ delay: 0.9 }} className="flex gap-2.5 sm:max-w-[92%]">
          <div className="bg-highlight/15 text-highlight flex size-7 shrink-0 items-center justify-center rounded-full">
            <Bot className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl rounded-tl-md border bg-white/[0.03] p-3">
            <p className="text-sm">{g.found}</p>
            <div className="flex items-center gap-3 rounded-xl border p-2.5">
              <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/60 via-violet-600/50 to-slate-900 font-mono text-[9px] font-semibold text-white/80">
                PSA 10
              </div>
              {/* Price under the name rather than beside it, so the name keeps its width on a phone. */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Umbreon VMAX</p>
                <p className="text-muted-foreground truncate text-xs">Evolving Skies · 215/203</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{formatThb(24_900)}</p>
              </div>
            </div>
            <div aria-hidden className="flex gap-2">
              <span className="bg-success text-success-foreground rounded-full px-4 py-1.5 text-xs font-semibold">{g.approve}</span>
              <span className="text-muted-foreground rounded-full border px-4 py-1.5 text-xs font-semibold">{g.skip}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </MockFrame>
  );
}

// ---------------------------------------------------------------------------

export function FeatureShowcase() {
  const { t } = useLanguage();
  const s = t.showcase;

  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="border-highlight/30 bg-highlight/10 text-highlight rounded-full border px-3 py-1 text-xs font-medium">
            {s.badge}
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{s.title}</h2>
          <p className="text-muted-foreground mt-4 text-balance">{s.subtitle}</p>
        </div>

        <div className="mt-16 flex flex-col gap-24 sm:mt-20 sm:gap-32">
          <FeatureRow index={1} {...s.market}>
            <MarketMock />
          </FeatureRow>
          <FeatureRow index={2} reverse {...s.escrow}>
            <EscrowMock />
          </FeatureRow>
          <FeatureRow index={3} {...s.auction}>
            <AuctionMock />
          </FeatureRow>
          <FeatureRow index={4} reverse {...s.agent}>
            <AgentMock />
          </FeatureRow>
        </div>
      </div>
    </section>
  );
}
