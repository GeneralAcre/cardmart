"use client";

import { useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyPortfolioPriceHistory } from "@/lib/actions";
import { useCurrency } from "@/components/currency-provider";
import { formatMoneyCompact } from "@/lib/currency";
import type { PriceHistoryRange } from "@/lib/queries";
import { useLanguage } from "@/components/landing/language-provider";

interface ValuePoint {
  totalThb: number;
  createdAt: string;
}

const RANGE_LABELS: Record<PriceHistoryRange, string> = { "1d": "24H", "7d": "7D", "30d": "30D" };

// Same real-data-only rule as the per-item price chart: every point here
// comes from lib/queries.ts's getPortfolioPriceHistory, which merges the
// real PriceSnapshot rows across every asset the user owns — nothing
// fabricated, and it starts sparse until real pricing events accumulate.
export function PortfolioValueChart({ initialHistory }: { initialHistory: ValuePoint[] }) {
  const { currency, money } = useCurrency();
  const [range, setRange] = useState<PriceHistoryRange>("7d");
  const [history, setHistory] = useState(initialHistory);
  const [pending, startTransition] = useTransition();
  const { locale, tr: t } = useLanguage();
  const chartConfig = {
    totalThb: { label: t("Total Value"), color: "var(--foreground)" },
  } satisfies ChartConfig;

  function handleRangeChange(next: PriceHistoryRange) {
    setRange(next);
    startTransition(async () => {
      const data = await getMyPortfolioPriceHistory(next);
      setHistory(data);
    });
  }

  // Plotted by real time, so the gaps between points are true to the calendar
  // and an axis date is never repeated.
  const chartData = history.map((p) => ({ t: new Date(p.createdAt).getTime(), totalThb: p.totalThb }));
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const formatTick = (ms: number) =>
    range === "1d"
      ? new Date(ms).toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" })
      : new Date(ms).toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
  const latest = history.at(-1)?.totalThb ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-semibold tabular-nums">{latest != null ? money(latest) : "—"}</span>
        </div>
        <Tabs value={range} onValueChange={(v) => handleRangeChange(v as PriceHistoryRange)}>
          <TabsList>
            {(Object.keys(RANGE_LABELS) as PriceHistoryRange[]).map((r) => (
              <TabsTrigger key={r} value={r}>
                {RANGE_LABELS[r]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {chartData.length >= 2 ? (
        <ChartContainer config={chartConfig} className={`max-h-40 ${pending ? "opacity-50" : ""}`}>
          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalThb)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-totalThb)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTick}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={48}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(v: number) => formatMoneyCompact(v, currency)}
            />
            <ChartTooltip
              content={(props) => (
                <ChartTooltipContent
                  {...props}
                  labelFormatter={(_, items) => {
                    const ms = items?.[0]?.payload?.t;
                    return typeof ms === "number" ? new Date(ms).toLocaleString(dateLocale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
                  }}
                  formatter={(value) => <span className="font-medium tabular-nums">{money(Number(value))}</span>}
                />
              )}
            />
            <Area
              dataKey="totalThb"
              type="monotone"
              fill="url(#portfolioValueFill)"
              stroke="var(--color-totalThb)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground text-xs">
          {latest != null
            ? t("Not enough history yet to draw a trend for this range.")
            : t("No priced assets yet — list or reprice something to start tracking value over time.")}
        </p>
      )}
    </div>
  );
}
