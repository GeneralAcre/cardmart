"use client";

import Link from "next/link";
import { Anchor, ArrowDown, ArrowUp, ChevronRight, Minus } from "lucide-react";
import { Area, AreaChart, Tooltip, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { MarketIndex } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const NAMES: Record<MarketIndex["key"], string> = {
  ALL: "CardMart Index",
  POKEMON: "Pokémon Index",
  ONE_PIECE: "One Piece Index",
};

// Each index opens its own page listing the cards inside it.
const HREF: Record<MarketIndex["key"], string> = {
  ALL: "/market/index/cardmart",
  POKEMON: "/market/index/pokemon",
  ONE_PIECE: "/market/index/one-piece",
};

// Small tile for an index: the CardMart star, a Poké Ball, or an anchor.
function IndexIcon({ index }: { index: MarketIndex["key"] }) {
  return (
    <span aria-hidden className="bg-foreground/[0.07] flex size-7 shrink-0 items-center justify-center rounded-full">
      {index === "ALL" ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static logo
        <img src="/cardmart-logo.png" alt="" className="size-3.5 object-contain" />
      ) : index === "POKEMON" ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h5.5M15.5 12H21" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <Anchor className="size-3.5" />
      )}
    </span>
  );
}

const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const toneClass = (pct: number | null) =>
  pct == null || Math.abs(pct) < 0.05 ? "text-muted-foreground" : pct > 0 ? "text-success" : "text-destructive";
const formatPct = (pct: number | null) => (pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`);

/** The index's line, green when it's up over its history and red when down, with a hover tooltip. */
function Sparkline({ index, className, tooltip = true }: { index: MarketIndex; className: string; tooltip?: boolean }) {
  const { locale, tr: t } = useLanguage();
  const first = index.points[0];
  const last = index.points.at(-1);
  const up = (last?.price ?? 0) >= (first?.price ?? 0);
  const config = { price: { label: t(NAMES[index.key]), color: up ? "var(--success)" : "var(--destructive)" } } satisfies ChartConfig;
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const fillId = `indexFill-${index.key}-${tooltip ? "card" : "row"}`;

  return (
    <ChartContainer config={config} className={cn("aspect-auto", className)}>
      <AreaChart data={index.points} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        {tooltip && (
          <Tooltip
            cursor={{ strokeDasharray: "3 3", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="bg-background/95 rounded-md border px-2 py-1 shadow-lg">
                  <p className="text-muted-foreground text-[10px]">{new Date(p.t).toLocaleDateString(dateLocale)}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatLevel(p.price)}</p>
                </div>
              );
            }}
          />
        )}
        <Area
          dataKey="price"
          type="monotone"
          stroke="var(--color-price)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          isAnimationActive={false}
          activeDot={tooltip ? { r: 4, strokeWidth: 2, fill: "var(--background)", stroke: "var(--color-price)" } : false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** The change as a small pill: an arrow and the percentage, tinted green, red or neutral. */
function ChangePill({ pct }: { pct: number | null }) {
  const flat = pct == null || Math.abs(pct) < 0.05;
  const Arrow = flat ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        toneClass(pct),
        flat ? "bg-foreground/[0.06]" : pct > 0 ? "bg-success/15" : "bg-destructive/15",
      )}
    >
      <Arrow className="size-3" />
      {pct == null ? "—" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}

/** The light under a card: a bright hairline on the bottom edge and a glow rising from it. */
function Beam({ strong }: { strong?: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 transition-opacity duration-300",
          strong ? "opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
        style={{ backgroundImage: "radial-gradient(70% 100% at 50% 100%, color-mix(in oklab, var(--success) 34%, transparent), transparent 75%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-px w-3/5 -translate-x-1/2"
        style={{
          backgroundImage: "linear-gradient(90deg, transparent, var(--success), transparent)",
          boxShadow: "0 0 20px 2px color-mix(in oklab, var(--success) 55%, transparent)",
        }}
      />
    </>
  );
}

/** Desktop: a glass card per index, lit from below. */
function IndexCard({ index }: { index: MarketIndex }) {
  const { tr: t } = useLanguage();
  const last = index.points.at(-1);
  const prev = index.points.at(-2);

  return (
    <Link
      href={HREF[index.key]}
      className="bg-card hover:border-success/40 group relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl border px-5 pt-5 pb-7 transition-[border-color,transform] duration-300 hover:-translate-y-0.5"
    >
      {/* Glass: a faint sheen falling from the top-left corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "linear-gradient(150deg, color-mix(in oklab, var(--foreground) 8%, transparent), transparent 42%)" }}
      />
      <Beam />

      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="bg-foreground/[0.05] flex min-w-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium">
          <IndexIcon index={index.key} />
          <span className="truncate">{t(NAMES[index.key])}</span>
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </span>
        <ChangePill pct={index.change1d} />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {prev ? t("Prev {value}", { value: formatLevel(prev.price) }) : t("Just started tracking")}
            {" · "}
            {t("{count} cards", { count: index.constituents })}
          </span>
          <span className="text-4xl leading-none font-semibold tracking-tight tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
        </div>
        {index.points.length >= 2 ? (
          <Sparkline index={index} className="h-14 w-28 shrink-0" tooltip={false} />
        ) : (
          // Nothing to draw yet: a dashed baseline, so the card doesn't look broken.
          <svg aria-hidden viewBox="0 0 112 56" className="text-muted-foreground h-14 w-28 shrink-0">
            <path d="M2 30 H110" stroke="currentColor" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" opacity="0.45" />
          </svg>
        )}
      </div>
    </Link>
  );
}

/** Phones: a small tile per index, three side by side, like a stock app's ticker strip. */
function IndexTile({ index }: { index: MarketIndex }) {
  const { tr: t } = useLanguage();
  const last = index.points.at(-1);

  return (
    <Link href={HREF[index.key]} className="bg-card active:bg-accent group relative isolate flex min-w-0 flex-col gap-1.5 overflow-hidden p-2.5 pb-3.5">
      <Beam strong />
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold">{t(NAMES[index.key])}</span>
        <span className={cn("shrink-0 text-xs font-semibold tabular-nums", toneClass(index.change1d))}>{formatPct(index.change1d)}</span>
      </span>
      <span className="mt-0.5 text-lg leading-tight font-bold tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
    </Link>
  );
}

/**
 * The indexes, like a stock market's headline indexes: one level for CardMart's
 * own cards and one each for the 50 most valuable Pokémon and One Piece cards.
 */
export function MarketIndexes({ indexes }: { indexes: MarketIndex[] }) {
  if (indexes.every((i) => i.points.length === 0)) return null;
  return (
    <>
      <div className="bg-border grid grid-cols-3 gap-px overflow-hidden rounded-xl border md:hidden">
        {indexes.map((index) => (
          <IndexTile key={index.key} index={index} />
        ))}
      </div>
      <section className="relative isolate hidden md:block">
        {/* The beams spill a little light onto the page under the cards. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[6%] -bottom-10 -z-10 h-36 blur-3xl"
          style={{ backgroundImage: "radial-gradient(60% 100% at 50% 100%, color-mix(in oklab, var(--success) 22%, transparent), transparent 70%)" }}
        />
        <div className="grid grid-cols-3 gap-4">
          {indexes.map((index) => (
            <IndexCard key={index.key} index={index} />
          ))}
        </div>
      </section>
    </>
  );
}
