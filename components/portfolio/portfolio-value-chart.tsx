"use client";

import { useState, useTransition } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getMyPortfolioPriceHistory } from "@/lib/actions";
import { useCurrency } from "@/components/currency-provider";
import type { PriceHistoryRange } from "@/lib/queries";
import { cn } from "@/lib/utils";
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
//
// A small trend line under the profit figure (PortfolioStats), not a big
// chart: no axes or grid, green when the value rose over the range and red
// when it fell. Hovering shows the exact value and time.
export function PortfolioValueChart({ initialHistory }: { initialHistory: ValuePoint[] }) {
  const { money } = useCurrency();
  const [range, setRange] = useState<PriceHistoryRange>("7d");
  const [history, setHistory] = useState(initialHistory);
  const [pending, startTransition] = useTransition();
  const { locale, tr: t } = useLanguage();

  function handleRangeChange(next: PriceHistoryRange) {
    setRange(next);
    startTransition(async () => {
      const data = await getMyPortfolioPriceHistory(next);
      setHistory(data);
    });
  }

  const chartData = history.map((p) => ({ t: new Date(p.createdAt).getTime(), totalThb: p.totalThb }));
  const first = history[0]?.totalThb;
  const last = history.at(-1)?.totalThb;
  const color =
    first == null || last == null || last === first ? "var(--muted-foreground)" : last > first ? "var(--success)" : "var(--destructive)";
  const chartConfig = { totalThb: { label: t("Total Value"), color } } satisfies ChartConfig;
  const dateLocale = locale === "th" ? "th-TH" : "en-US";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium">{t("Value over time")}</span>
        <div className="bg-muted flex rounded-lg p-0.5 text-xs font-medium">
          {(Object.keys(RANGE_LABELS) as PriceHistoryRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRangeChange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {chartData.length >= 2 ? (
        <ChartContainer config={chartConfig} className={cn("aspect-auto h-20 w-full", pending && "opacity-50")}>
          <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalThb)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-totalThb)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
            {/* Some room above and below the line; a value that never moved sits in the middle. */}
            <YAxis domain={([min, max]: readonly number[]) => (min === max ? [min * 0.9, max * 1.1] : [min - (max - min) * 0.2, max + (max - min) * 0.2])} hide />
            <ChartTooltip
              content={(props) => (
                <ChartTooltipContent
                  {...props}
                  labelFormatter={(_, items) => {
                    const ms = items?.[0]?.payload?.t;
                    return typeof ms === "number"
                      ? new Date(ms).toLocaleString(dateLocale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                      : null;
                  }}
                  formatter={(value) => <span className="font-medium tabular-nums">{money(Number(value))}</span>}
                />
              )}
            />
            <Area dataKey="totalThb" type="monotone" fill="url(#portfolioValueFill)" stroke="var(--color-totalThb)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground flex h-20 items-center justify-center text-center text-xs">
          {last != null
            ? t("Not enough history yet to draw a trend for this range.")
            : t("No priced assets yet — list or reprice something to start tracking value over time.")}
        </p>
      )}
    </div>
  );
}
