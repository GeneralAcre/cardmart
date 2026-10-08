"use client";

import { useMemo, useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";
import { tierKey } from "@/lib/grade-tier";
import { GradeCompare } from "@/components/item/grade-compare";
import { getEbayQuoteForGrade } from "@/lib/actions";
import type { EbayPriceQuote } from "@/lib/ebay";

interface Tier {
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
}

export interface MarketSale extends Tier {
  id: string;
  amountThb: number;
  soldAt: string;
}


// Every grade the picker offers, in the order collectors scan them: raw,
// then each grader from the top grade down.
const CONDITIONS: Tier[] = [
  { gradingCompany: "RAW", grade: null, isBlackLabel: false },
  ...[10, 9, 8].map((grade) => ({
    gradingCompany: "PSA",
    grade,
    isBlackLabel: false,
  })),
  ...[10, 9.5, 9].map((grade) => ({
    gradingCompany: "CGC",
    grade,
    isBlackLabel: false,
  })),
  { gradingCompany: "BGS", grade: 10, isBlackLabel: true },
  ...[10, 9.5, 9].map((grade) => ({
    gradingCompany: "BGS",
    grade,
    isBlackLabel: false,
  })),
];
const COMPANY_ORDER = ["RAW", "PSA", "CGC", "BGS"];

const RANGES = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const DAY = 86_400_000;

/**
 * The card's market price over time in one grade: real CardMart sales of this
 * card in that grade. For this listing's own grade with fewer than two sales,
 * it falls back to this listing's own price changes, and says so. The line
 * carries the last known price into the start of the range and on to today,
 * so a quiet card reads as a flat line rather than an empty chart.
 */
export function MarketPriceHistory({
  assetId,
  current,
  subtitle,
  sales,
  listingHistory,
  listingThb,
  listings,
  initialEbay,
  tcg,
  baseQuery,
}: {
  assetId: string;
  current: Tier;
  subtitle: string;
  sales: MarketSale[];
  listingHistory: { priceThb: number; createdAt: string }[];
  // This listing's asking price, or null when it isn't for sale.
  listingThb: number | null;
  // Other live CardMart listings of this card, in any grade.
  listings: (Tier & { priceThb: number })[];
  // eBay quotes preloaded on the server, by tier key; other grades load on pick.
  initialEbay: Record<string, EbayPriceQuote | null>;
  tcg: { marketPriceUsd: number; matchedName: string } | null;
  // Card name, set and number, without a grade: the outside searches add it.
  baseQuery: string;
}) {
  const { locale, tr: t } = useLanguage();
  const [tab, setTab] = useState<"history" | "sales">("history");
  const [range, setRange] = useState<RangeKey>("90d");
  const [condition, setCondition] = useState(tierKey(current));
  const [ebay, setEbay] = useState(initialEbay);
  const [, startTransition] = useTransition();
  // Read once per mount: the chart's "today" shouldn't shift on every render.
  const [now] = useState(() => Date.now());

  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const tierName = (tier: Tier) =>
    tier.gradingCompany === "RAW"
      ? t("Ungraded")
      : `${tier.gradingCompany} ${formatGrade(tier.grade)}${tier.isBlackLabel ? " Black Label" : ""}`;

  const conditions = useMemo(() => {
    const byKey = new Map<string, Tier>(CONDITIONS.map((c) => [tierKey(c), c]));
    for (const tier of [current, ...sales]) byKey.set(tierKey(tier), tier);
    return [...byKey.entries()]
      .map(([key, tier]) => ({ key, tier }))
      .sort(
        (a, b) =>
          COMPANY_ORDER.indexOf(a.tier.gradingCompany) - COMPANY_ORDER.indexOf(b.tier.gradingCompany) ||
          Number(b.tier.isBlackLabel) - Number(a.tier.isBlackLabel) ||
          (b.tier.grade ?? 0) - (a.tier.grade ?? 0),
      );
  }, [current, sales]);
  const selected = conditions.find((c) => c.key === condition)?.tier ?? current;
  const isOwnGrade = condition === tierKey(current);
  const query =
    selected.gradingCompany === "RAW"
      ? baseQuery
      : `${baseQuery} ${selected.gradingCompany} ${formatGrade(selected.grade)}${selected.isBlackLabel ? " Black Label" : ""}`;

  function pickCondition(key: string) {
    setCondition(key);
    const tier = conditions.find((c) => c.key === key)?.tier;
    if (!tier || key in ebay) return;
    startTransition(async () => {
      const quote = await getEbayQuoteForGrade(assetId, tier).catch(() => null);
      setEbay((prev) => ({ ...prev, [key]: quote }));
    });
  }

  const tierSales = sales
    .filter((s) => tierKey(s) === condition)
    .sort((a, b) => new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime());
  const useListing = isOwnGrade && tierSales.length < 2 && listingHistory.length > 0;
  const source = useListing
    ? listingHistory.map((p) => ({
        t: new Date(p.createdAt).getTime(),
        price: p.priceThb,
      }))
    : tierSales.map((s) => ({
        t: new Date(s.soldAt).getTime(),
        price: s.amountThb,
      }));

  const days = RANGES.find((r) => r.key === range)!.days;
  const start = days == null ? (source[0]?.t ?? now) : now - days * DAY;
  const before = source.filter((p) => p.t < start).at(-1);
  const inRange = source.filter((p) => p.t >= start);
  const points = [...(before ? [{ t: start, price: before.price }] : []), ...inRange];
  const last = points.at(-1);
  if (last && last.t < now) points.push({ t: now, price: last.price });

  const first = points[0]?.price;
  const latest = last?.price;
  const changePct = first && latest != null ? ((latest - first) / first) * 100 : null;
  const up = changePct == null || changePct >= 0;
  // Another grade than this listing gets its own color: its line is context, not this card's trend.
  const lineColor = !isOwnGrade
    ? "var(--compare)"
    : changePct == null || changePct === 0 || up
      ? "var(--success)"
      : "var(--destructive)";
  const chartConfig = {
    price: { label: t("Price"), color: lineColor },
  } satisfies ChartConfig;

  const formatDay = (ms: number) =>
    new Date(ms).toLocaleDateString(dateLocale, {
      month: "short",
      day: "numeric",
      ...(days == null || days > 90 ? { year: "2-digit" } : {}),
    });
  const formatAxisPrice = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : String(v));

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-secondary/60 flex w-fit gap-1 rounded-xl border p-1">
        {(
          [
            ["history", t("Price History")],
            ["sales", t("Recent Sales")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tab === "history" ? t("Market Price History") : t("Recent Sales")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {tierName(selected)} · {subtitle}.{" "}
            {tab === "sales"
              ? t("Completed CardMart sales of this card.")
              : useListing
                ? t("This listing's price changes — not enough sales in this grade yet.")
                : t("Completed CardMart sales of this card in this grade.")}
          </p>
        </div>
        {tab === "history" && latest != null && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl font-bold tabular-nums">{formatThb(latest)}</span>
            {changePct != null && (
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  !isOwnGrade ? "text-compare" : up ? "text-success" : "text-destructive",
                )}
              >
                {up ? "+" : ""}
                {changePct.toFixed(1)}% {t("in range")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted-foreground text-xs">{t("Condition")}</span>
          <Select value={condition} onValueChange={pickCondition}>
            <SelectTrigger className="h-11 w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conditions.map((c) => (
                <SelectItem
                  key={c.key}
                  value={c.key}
                  className={cn(c.key === tierKey(current) && "text-success focus:text-success font-semibold")}
                  suffix={
                    c.key === tierKey(current) && (
                      <span className="bg-success/15 text-success rounded px-1.5 py-0.5 text-[10px] font-semibold">
                        {t("This card")}
                      </span>
                    )
                  }
                >
                  {tierName(c.tier)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tab === "history" && (
          <div className="bg-secondary/60 flex gap-1 rounded-xl border p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  range === r.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "history" ? (
        <div className="bg-card relative overflow-hidden rounded-2xl border p-4 sm:p-6">
          {/* Watermark behind the line, like a broadcast chart. */}
          <span
            aria-hidden
            className="text-foreground/[0.04] pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black tracking-tighter italic select-none sm:text-8xl"
          >
            CARDMART
          </span>
          {points.length >= 2 ? (
            <ChartContainer
              config={chartConfig}
              className="relative aspect-auto h-[320px] w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[var(--color-price)]"
            >
              <AreaChart data={points} margin={{ left: 0, right: 16, top: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
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
                  tickFormatter={formatDay}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={40}
                />
                <YAxis
                  dataKey="price"
                  domain={[(min: number) => Math.floor(min * 0.9), (max: number) => Math.ceil(max * 1.1)]}
                  tickFormatter={formatAxisPrice}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={52}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "4 4", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const p = active ? payload?.[0]?.payload : null;
                    if (!p) return null;
                    return (
                      <div className="bg-background/95 rounded-lg border px-3 py-2 shadow-lg">
                        <p className="text-muted-foreground text-[11px]">{new Date(p.t).toLocaleDateString(dateLocale)}</p>
                        <p className="text-base font-bold tabular-nums">{formatThb(p.price)}</p>
                      </div>
                    );
                  }}
                />
                <Area
                  dataKey="price"
                  type="monotone"
                  fill="url(#marketFill)"
                  stroke="var(--color-price)"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  activeDot={{
                    r: 6,
                    strokeWidth: 3,
                    fill: "var(--background)",
                    stroke: "var(--color-price)",
                  }}
                  dot={(props: { cx?: number; cy?: number; index?: number }) =>
                    props.index === points.length - 1 ? (
                      <circle
                        key="last"
                        cx={props.cx}
                        cy={props.cy}
                        r={6}
                        strokeWidth={3}
                        fill="var(--background)"
                        stroke="var(--color-price)"
                      />
                    ) : (
                      <g key={props.index} />
                    )
                  }
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="relative flex h-[200px] flex-col items-center justify-center gap-1 text-center">
              <p className="font-semibold">{t("No price history in this grade yet")}</p>
              <p className="text-muted-foreground text-sm">{t("It fills in as this card sells on CardMart.")}</p>
            </div>
          )}
        </div>
      ) : tierSales.length === 0 ? (
        <div className="bg-card text-muted-foreground rounded-2xl border p-8 text-center text-sm">
          {t("No completed sales of this card in this grade yet.")}
        </div>
      ) : (
        <ul className="bg-card divide-y rounded-2xl border">
          {[...tierSales].reverse().map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{tierName(s)}</span>
                <span className="text-muted-foreground text-xs">{new Date(s.soldAt).toLocaleDateString(dateLocale)}</span>
              </div>
              <span className="font-semibold tabular-nums">{formatThb(s.amountThb)}</span>
            </li>
          ))}
        </ul>
      )}

      <GradeCompare
        tierName={tierName(selected)}
        isOwnGrade={isOwnGrade}
        listingThb={listingThb}
        listingGradeName={tierName(current)}
        asks={listings.filter((l) => tierKey(l) === condition).map((l) => l.priceThb)}
        salePrices={tierSales.map((s) => s.amountThb)}
        ebay={ebay[condition]}
        tcg={selected.gradingCompany === "RAW" ? tcg : null}
        query={query}
      />
    </section>
  );
}
