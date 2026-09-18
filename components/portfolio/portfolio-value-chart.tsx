"use client";

import { useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LineChart } from "lucide-react";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyPortfolioPriceHistory } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import type { PriceHistoryRange } from "@/lib/queries";

interface ValuePoint {
  totalThb: number;
  createdAt: string;
}

const RANGE_LABELS: Record<PriceHistoryRange, string> = { "1d": "24H", "7d": "7D", "30d": "30D" };

const chartConfig = {
  totalThb: { label: "Total Value", color: "var(--foreground)" },
} satisfies ChartConfig;

// Same real-data-only rule as the per-item price chart: every point here
// comes from lib/queries.ts's getPortfolioPriceHistory, which merges the
// real PriceSnapshot rows across every asset the user owns — nothing
// fabricated, and it starts sparse until real pricing events accumulate.
export function PortfolioValueChart({ initialHistory }: { initialHistory: ValuePoint[] }) {
  const [range, setRange] = useState<PriceHistoryRange>("7d");
  const [history, setHistory] = useState(initialHistory);
  const [pending, startTransition] = useTransition();

  function handleRangeChange(next: PriceHistoryRange) {
    setRange(next);
    startTransition(async () => {
      const data = await getMyPortfolioPriceHistory(next);
      setHistory(data);
    });
  }

  const chartData = history.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    totalThb: p.totalThb,
  }));
  const latest = history.at(-1)?.totalThb ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="text-muted-foreground size-4" />
          <span className="text-muted-foreground text-xs">Portfolio Value</span>
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
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <ChartTooltip content={(props) => <ChartTooltipContent {...props} hideLabel />} />
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
        <p className="text-muted-foreground py-6 text-center text-xs">
          {latest != null
            ? `Currently ${formatThb(latest)} — not enough history yet to plot a trend in this window.`
            : "No priced assets yet — list or reprice something to start tracking value over time."}
        </p>
      )}
    </div>
  );
}
