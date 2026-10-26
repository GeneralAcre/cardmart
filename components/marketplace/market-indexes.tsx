"use client";

import { GameIcon } from "@/components/ui/game-icon";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Area, AreaChart, Tooltip, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { MarketIndex } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { ChangeTag } from "@/components/ui/change-tag";
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
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center">
      {index === "ALL" ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static logo
        <img src="/cardmart-star.png" alt="" className="logo-adaptive size-3.5 object-contain" />
      ) : (
        <GameIcon game={index} size={20} />
      )}
    </span>
  );
}

const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The index's line is green when up and red when down, with a hover tooltip. */
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

/** A neutral white glow under a card, with a soft hairline along its bottom edge. */
function Beam({ strong }: { strong?: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "dark-only",
          "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 transition-opacity duration-300",
          strong ? "opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
        style={{ backgroundImage: "radial-gradient(70% 100% at 50% 100%, color-mix(in oklab, var(--foreground) 24%, transparent), transparent 75%)" }}
      />
      <div
        aria-hidden
        className="dark-only pointer-events-none absolute bottom-0 left-1/2 h-px w-3/5 -translate-x-1/2"
        style={{
          backgroundImage: "linear-gradient(90deg, transparent, var(--foreground), transparent)",
          boxShadow: "0 0 20px 2px color-mix(in oklab, var(--foreground) 40%, transparent)",
        }}
      />
    </>
  );
}

/** Desktop: a glass card per index, lit from below. */
function IndexCard({ index }: { index: MarketIndex }) {
  const { tr: t } = useLanguage();
  const last = index.points.at(-1);

  return (
    <Link
      href={HREF[index.key]}
      className="bg-card hover:border-success/40 group relative isolate flex w-full flex-col justify-between gap-5 overflow-hidden rounded-3xl border px-5 pt-5 pb-7 transition-[border-color,transform] duration-300 hover:-translate-y-0.5"
    >
      {/* Glass: a faint sheen falling from the top-left corner. */}
      <div
        aria-hidden
        className="dark-only pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "linear-gradient(150deg, color-mix(in oklab, var(--foreground) 8%, transparent), transparent 42%)" }}
      />
      <Beam />

      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="bg-foreground/[0.05] flex min-w-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium">
          <IndexIcon index={index.key} />
          <span className="truncate">{t(NAMES[index.key])}</span>
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </span>
        <ChangeTag pct={index.change1d} pill />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {index.key === "ALL" ? t("Top 10 listed on CardMart") : t("Top 50 by market cap")}
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

/** The indexes, like a stock market's headline indexes. */
export function MarketIndexes({ indexes }: { indexes: MarketIndex[] }) {
  if (indexes.every((i) => i.points.length === 0)) return null;
  return (
    <>
      {/* Phones: the same glass cards as desktop, in a row you swipe through, with the next card peeking in. */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {indexes.map((index) => (
          <div key={index.key} className="flex w-[82%] shrink-0 snap-start">
            <IndexCard index={index} />
          </div>
        ))}
      </div>
      <section className="relative isolate hidden md:block">
        {/* The beams spill a little light onto the page under the cards. */}
        <div
          aria-hidden
          className="dark-only pointer-events-none absolute inset-x-[6%] -bottom-10 -z-10 h-36 blur-3xl"
          style={{ backgroundImage: "radial-gradient(60% 100% at 50% 100%, color-mix(in oklab, var(--foreground) 18%, transparent), transparent 70%)" }}
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
