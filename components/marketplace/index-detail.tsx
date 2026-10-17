"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatGrade, formatThb } from "@/lib/format";
import type { IndexMember, MarketIndex } from "@/lib/stats";
import type { PricePoint } from "@/lib/stats-math";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const DAY = 86_400_000;
const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const toneClass = (pct: number | null) =>
  pct == null || Math.abs(pct) < 0.05 ? "text-muted-foreground" : pct > 0 ? "text-success" : "text-destructive";
const formatPct = (pct: number | null) => (pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`);
const lineColor = (points: { price: number }[]) =>
  (points.at(-1)?.price ?? 0) >= (points[0]?.price ?? 0) ? "var(--success)" : "var(--destructive)";

// Yahoo-style ranges. YTD starts on 1 January (UTC).
const RANGES = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "YTD", days: null },
  { key: "1Y", days: 365 },
  { key: "All", days: Infinity },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** The points in a range, starting from the last value before it so the line begins at the range's left edge. */
function sliceRange(points: PricePoint[], key: RangeKey): PricePoint[] {
  const last = points.at(-1);
  if (!last) return [];
  const range = RANGES.find((r) => r.key === key)!;
  const start =
    range.days === Infinity
      ? -Infinity
      : range.days == null
        ? Date.UTC(new Date(last.t).getUTCFullYear(), 0, 1)
        : last.t - range.days * DAY;
  const before = [...points].reverse().find((p) => p.t <= start);
  const inside = points.filter((p) => p.t > start);
  return before ? [before, ...inside] : inside;
}

const rangeReturn = (slice: PricePoint[]) =>
  slice.length >= 2 && slice[0].price > 0 ? ((slice.at(-1)!.price - slice[0].price) / slice[0].price) * 100 : null;

/** Quote header, range buttons with their returns, and the chart, like a stock quote page. */
export function IndexQuote({ index, name }: { index: MarketIndex; name: string }) {
  const { locale, tr: t } = useLanguage();
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const [range, setRange] = useState<RangeKey>("1M");
  const last = index.points.at(-1);
  const prev = index.points.at(-2);
  const dayChange = last && prev ? last.price - prev.price : null;
  const slice = sliceRange(index.points, range);
  const config = { price: { label: name, color: lineColor(slice) } } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-4xl font-bold tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
          {dayChange != null && (
            <span className={cn("text-lg font-semibold tabular-nums", toneClass(index.change1d))}>
              {dayChange > 0 ? "+" : dayChange < 0 ? "−" : ""}
              {formatLevel(Math.abs(dayChange))} ({formatPct(index.change1d)})
            </span>
          )}
        </div>
        {last && (
          <span className="text-muted-foreground text-xs">
            {t("As of {date}. Updated once a day from eBay market prices.", {
              date: new Date(last.t).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" }),
            })}
          </span>
        )}
      </div>

      <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {RANGES.map((r) => {
          const ret = rangeReturn(sliceRange(index.points, r.key));
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 transition-colors",
                range === r.key ? "bg-secondary" : "hover:bg-accent",
              )}
            >
              <span className={cn("text-sm font-semibold", range === r.key ? "text-foreground" : "text-muted-foreground")}>{t(r.key)}</span>
              <span className={cn("text-[11px] tabular-nums", toneClass(ret))}>{formatPct(ret)}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl border p-4 sm:p-6">
        {slice.length >= 2 ? (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <AreaChart data={slice} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="indexDetailFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 6" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(ms: number) => new Date(ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={40}
              />
              <YAxis
                dataKey="price"
                domain={[(min: number) => Math.floor(min * 0.98), (max: number) => Math.ceil(max * 1.02)]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={48}
              />
              <Tooltip
                cursor={{ strokeDasharray: "4 4", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const p = active ? payload?.[0]?.payload : null;
                  if (!p) return null;
                  return (
                    <div className="bg-background/95 rounded-lg border px-3 py-2 shadow-lg">
                      <p className="text-muted-foreground text-[11px]">{new Date(p.t).toLocaleDateString(dateLocale)}</p>
                      <p className="text-base font-bold tabular-nums">{formatLevel(p.price)}</p>
                    </div>
                  );
                }}
              />
              <Area
                dataKey="price"
                type="monotone"
                fill="url(#indexDetailFill)"
                stroke="var(--color-price)"
                strokeWidth={2.5}
                isAnimationActive={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: "var(--background)", stroke: "var(--color-price)" }}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="text-muted-foreground flex h-72 items-center justify-center text-center text-sm">
            {t("The chart builds up as a new market price is saved each day.")}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberSparkline({ member }: { member: IndexMember }) {
  if (member.points.length < 2) return <span className="text-muted-foreground text-xs">—</span>;
  const config = { price: { label: member.name, color: lineColor(member.points) } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-8 w-24">
      <LineChart data={member.points} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line dataKey="price" type="monotone" stroke="var(--color-price)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

const gradeLabel = (m: IndexMember, ungraded: string) =>
  m.gradingCompany === "RAW" || m.grade == null
    ? ungraded
    : `${m.gradingCompany} ${formatGrade(m.grade)}${m.isBlackLabel ? " · Black Label" : ""}`;

const SORTS = [
  { key: "long", label: "Best performers" },
  { key: "1d", label: "Today" },
  { key: "price", label: "Price" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

/** Every card inside the index with its price and moves, sortable. */
export function IndexMembers({ members, longLabel }: { members: IndexMember[]; longLabel: string }) {
  const { tr: t } = useLanguage();
  const [sort, setSort] = useState<SortKey>("long");

  if (members.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        {t("No cards have a market price yet.")}
      </p>
    );
  }

  const value = (m: IndexMember) =>
    sort === "price" ? m.latestThb : sort === "1d" ? (m.change1d ?? -Infinity) : (m.change30dOrSince ?? -Infinity);
  const sorted = [...members].sort((a, b) => value(b) - value(a));

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted flex w-fit rounded-lg p-0.5 text-xs font-medium">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors",
              sort === s.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(s.label)}
          </button>
        ))}
      </div>
      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="text-muted-foreground hidden grid-cols-[2rem_minmax(0,1fr)_6rem_7rem_4.5rem_5.5rem] gap-3 border-b px-4 py-2.5 text-[11px] font-semibold tracking-wide uppercase sm:grid">
          <span>#</span>
          <span>{t("Card")}</span>
          <span>{t("Trend")}</span>
          <span className="text-right">{t("Price")}</span>
          <span className="text-right">{t("1D")}</span>
          <span className="text-right">{longLabel}</span>
        </div>
        <ol className="divide-y">
          {sorted.map((m, i) => {
            const body = (
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_7rem_4.5rem_5.5rem]">
                <span className="text-muted-foreground text-sm tabular-nums">{i + 1}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="card-stage relative h-12 w-9 shrink-0 overflow-hidden rounded-md border">
                    {m.photoUrl && <Image src={m.photoUrl} alt="" fill sizes="36px" className="object-contain p-0.5" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{m.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {gradeLabel(m, t("Ungraded"))} · {m.subtitle}
                      {m.cardNumber && ` · #${m.cardNumber}`}
                    </span>
                  </span>
                </div>
                <span className="hidden sm:block">
                  <MemberSparkline member={m} />
                </span>
                <span className="hidden text-right text-sm font-semibold tabular-nums sm:block">{formatThb(m.latestThb)}</span>
                <span className={cn("hidden text-right text-sm tabular-nums sm:block", toneClass(m.change1d))}>{formatPct(m.change1d)}</span>
                {/* Phones: price above the longer-term move, in the last column. */}
                <span className="flex flex-col items-end sm:block sm:text-right">
                  <span className="text-sm font-semibold tabular-nums sm:hidden">{formatThb(m.latestThb)}</span>
                  <span className={cn("text-sm font-semibold tabular-nums", toneClass(m.change30dOrSince))}>
                    {formatPct(m.change30dOrSince)}
                  </span>
                </span>
              </div>
            );
            return (
              <li key={m.key}>
                {m.assetId ? (
                  <Link href={`/item/${m.assetId}`} className="hover:bg-accent block transition-colors">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
