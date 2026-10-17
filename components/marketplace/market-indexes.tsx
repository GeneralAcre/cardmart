"use client";

import Link from "next/link";
import { Anchor, ChevronRight, Sparkles } from "lucide-react";
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

// Shared CardMart green and white accents keep the index cards cohesive.
const ACCENT: Record<MarketIndex["key"], { from: string; to: string; line: string }> = {
  ALL: { from: "rgba(204, 239, 32, 0.16)", to: "rgba(255, 255, 255, 0.035)", line: "rgba(204, 239, 32, 0.75)" },
  POKEMON: { from: "rgba(204, 239, 32, 0.16)", to: "rgba(255, 255, 255, 0.035)", line: "rgba(204, 239, 32, 0.75)" },
  ONE_PIECE: { from: "rgba(204, 239, 32, 0.16)", to: "rgba(255, 255, 255, 0.035)", line: "rgba(204, 239, 32, 0.75)" },
};

function IndexIcon({ index }: { index: MarketIndex["key"] }) {
  const a = ACCENT[index];
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border"
      style={{ backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
    >
      {index === "ALL" ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static logo
        <img src="/cardmart-logo.png" alt="" className="size-4 object-contain" />
      ) : index === "POKEMON" ? (
        <Sparkles className="size-4" />
      ) : (
        <Anchor className="size-4" />
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

/** Desktop: a card per index with its chart. */
function IndexCard({ index }: { index: MarketIndex }) {
  const { tr: t } = useLanguage();
  const last = index.points.at(-1);

  return (
    <Link
      href={HREF[index.key]}
      className="bg-card hover:border-foreground/25 group relative isolate flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 transition-colors sm:p-5"
    >
      {/* The index's color: a glow from the top-left corner and a hairline on top. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${ACCENT[index.key].from} 0%, ${ACCENT[index.key].to} 38%, transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT[index.key].line}, transparent 75%)` }}
      />
      <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <IndexIcon index={index.key} />
          <span className="text-muted-foreground group-hover:text-foreground flex min-w-0 items-center gap-0.5 truncate text-sm font-medium transition-colors">
            {t(NAMES[index.key])} <ChevronRight className="size-3.5 shrink-0" />
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            toneClass(index.change1d),
            index.change1d == null || Math.abs(index.change1d) < 0.05
              ? "bg-muted"
              : index.change1d > 0
                ? "bg-success/12"
                : "bg-destructive/12",
          )}
        >
          {formatPct(index.change1d)}
        </span>
      </div>
      <div className="relative z-10 -mt-2 text-2xl font-bold tabular-nums tracking-tight">
        {last ? formatLevel(last.price) : "—"}
      </div>
      {index.points.length >= 2 ? (
        <Sparkline index={index} className="relative z-10 h-14 w-full" />
      ) : (
        <p className="text-muted-foreground relative z-10 flex h-14 items-center text-xs">
          {t("The chart builds up as a new market price is saved each day.")}
        </p>
      )}
    </Link>
  );
}

// Short names for the phone strip, where three tiles share one row.
/** Phones: a small tile per index, three side by side, like a stock app's ticker strip. */
function IndexTile({ index }: { index: MarketIndex }) {
  const { tr: t } = useLanguage();
  const last = index.points.at(-1);

  return (
    <Link href={HREF[index.key]} className="bg-card active:bg-accent flex min-w-0 flex-col gap-1.5 p-2.5">
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold">{t(NAMES[index.key])}</span>
        <span className={cn("shrink-0 text-xs font-semibold tabular-nums", toneClass(index.change1d))}>{formatPct(index.change1d)}</span>
      </span>
      <span className="mt-0.5 text-lg leading-tight font-bold tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
    </Link>
  );
}

/**
 * The CardMart indexes, like a stock market's headline indexes: one level per
 * game built from every tracked card's daily market price (lib/stats.ts).
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
      <section className="hidden grid-cols-3 gap-3 md:grid">
        {indexes.map((index) => (
          <IndexCard key={index.key} index={index} />
        ))}
      </section>
    </>
  );
}
