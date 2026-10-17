"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

/**
 * The longer-term move: 30 days, or — while the index is younger than that —
 * since the day it began, named by date so it never reads like a duplicate.
 */
function longChange(index: MarketIndex, t: (s: string, v?: Record<string, string | number>) => string, locale: string) {
  if (index.change30d != null) return { label: t("30D"), pct: index.change30d };
  const first = index.points[0];
  const date = first
    ? new Date(first.t).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })
    : "";
  return { label: t("Since {date}", { date }), pct: index.change30dOrSince };
}

/** Desktop: a card per index with its chart. */
function IndexCard({ index }: { index: MarketIndex }) {
  const { locale, tr: t } = useLanguage();
  const last = index.points.at(-1);
  const first = index.points[0];
  const long = longChange(index, t, locale);

  return (
    <Link
      href={HREF[index.key]}
      className="bg-card hover:border-foreground/30 group flex flex-col gap-3 rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-0.5 truncate text-xs font-medium transition-colors">
            {t(NAMES[index.key])} <ChevronRight className="size-3.5" />
          </span>
          <span className="text-2xl font-bold tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
        </div>
        <div className="flex shrink-0 gap-4 text-right">
          {[{ label: t("1D"), pct: index.change1d }, long].map((c) => (
            <span key={c.label} className="flex flex-col">
              <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{c.label}</span>
              <span className={cn("text-sm font-semibold tabular-nums", toneClass(c.pct))}>{formatPct(c.pct)}</span>
            </span>
          ))}
        </div>
      </div>
      {index.points.length >= 2 ? (
        <Sparkline index={index} className="h-14 w-full" />
      ) : (
        <p className="text-muted-foreground flex h-14 items-center text-xs">
          {t("The chart builds up as a new market price is saved each day.")}
        </p>
      )}
      <span className="text-muted-foreground text-[11px]">
        {first
          ? t("{count} cards · since {date}", {
              count: index.constituents,
              date: new Date(first.t).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" }),
            })
          : t("No market prices yet")}
      </span>
    </Link>
  );
}

// Short names for the phone strip, where three tiles share one row.
const SHORT_NAMES: Record<MarketIndex["key"], string> = {
  ALL: "CardMart",
  POKEMON: "Pokémon",
  ONE_PIECE: "One Piece",
};

/** Phones: a small tile per index, three side by side, like a stock app's ticker strip. */
function IndexTile({ index }: { index: MarketIndex }) {
  const { locale, tr: t } = useLanguage();
  const last = index.points.at(-1);
  const long = longChange(index, t, locale);

  return (
    <Link href={HREF[index.key]} className="bg-card active:bg-accent flex min-w-0 flex-col p-2.5">
      <span className="truncate text-sm font-semibold">{t(SHORT_NAMES[index.key])}</span>
      <span className="mt-0.5 text-lg leading-tight font-bold tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
      <span className={cn("text-xs font-semibold tabular-nums", toneClass(long.pct))}>{formatPct(long.pct)}</span>
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
