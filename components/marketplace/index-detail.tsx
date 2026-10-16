"use client";

import Image from "next/image";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatGrade, formatThb } from "@/lib/format";
import type { IndexMember, MarketIndex } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const toneClass = (pct: number | null) =>
  pct == null || Math.abs(pct) < 0.05 ? "text-muted-foreground" : pct > 0 ? "text-success" : "text-destructive";
const formatPct = (pct: number | null) => (pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`);
const lineColor = (points: { price: number }[]) =>
  (points.at(-1)?.price ?? 0) >= (points[0]?.price ?? 0) ? "var(--success)" : "var(--destructive)";

/** The index over its whole history, with dates and a hover tooltip. */
export function IndexChart({ index }: { index: MarketIndex }) {
  const { locale, tr: t } = useLanguage();
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const config = { price: { label: t("Level"), color: lineColor(index.points) } } satisfies ChartConfig;

  if (index.points.length < 2) {
    return (
      <div className="bg-card text-muted-foreground flex h-64 items-center justify-center rounded-2xl border p-6 text-center text-sm">
        {t("The chart builds up as a new market price is saved each day.")}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border p-4 sm:p-6">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <AreaChart data={index.points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
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

/** Every card inside the index, best performer first, with its price and moves. */
export function IndexMembers({ members, longLabel }: { members: IndexMember[]; longLabel: string }) {
  const { tr: t } = useLanguage();

  if (members.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        {t("No cards have a market price yet.")}
      </p>
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      <div className="text-muted-foreground hidden grid-cols-[2rem_minmax(0,1fr)_6rem_7rem_4.5rem_4.5rem] gap-3 border-b px-4 py-2.5 text-[11px] font-semibold tracking-wide uppercase sm:grid">
        <span>#</span>
        <span>{t("Card")}</span>
        <span>{t("Trend")}</span>
        <span className="text-right">{t("Price")}</span>
        <span className="text-right">{t("7D")}</span>
        <span className="text-right">{t(longLabel)}</span>
      </div>
      <ol className="divide-y">
        {members.map((m, i) => {
          const body = (
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_7rem_4.5rem_4.5rem]">
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
              <span className={cn("hidden text-right text-sm tabular-nums sm:block", toneClass(m.change7d))}>{formatPct(m.change7d)}</span>
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
  );
}
