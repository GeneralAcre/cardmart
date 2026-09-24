"use client";

import { useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LineChart } from "lucide-react";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssetPriceHistory } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import type { PriceHistoryRange } from "@/lib/queries";

interface PricePoint {
  priceThb: number;
  createdAt: string;
}

const RANGE_LABELS: Record<PriceHistoryRange, string> = { "1d": "24H", "7d": "7D", "30d": "30D" };

// Real price points only, recorded from lib/queries.ts's PriceSnapshot table
// whenever a listing is created or repriced — never a fabricated trend. A
// brand-new listing legitimately has just one point, in which case this
// shows the current price plainly instead of forcing a broken/flat "chart."
export function PriceHistoryChart({
  assetId,
  initialHistory,
  currentPriceThb,
}: {
  assetId: string;
  initialHistory: PricePoint[];
  currentPriceThb: number | null;
}) {
  const [range, setRange] = useState<PriceHistoryRange>("7d");
  const [history, setHistory] = useState(initialHistory);
  const [pending, startTransition] = useTransition();

  function handleRangeChange(next: PriceHistoryRange) {
    setRange(next);
    startTransition(async () => {
      const data = await getAssetPriceHistory(assetId, next);
      setHistory(data);
    });
  }

  const chartData = history.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    priceThb: p.priceThb,
  }));
  const firstPrice = chartData[0]?.priceThb;
  const lastPrice = chartData.at(-1)?.priceThb;
  const priceColor =
    firstPrice == null || lastPrice == null || firstPrice === lastPrice
      ? "var(--muted-foreground)"
      : lastPrice > firstPrice
        ? "var(--success)"
        : "var(--destructive)";
  const chartConfig = {
    priceThb: { label: "Price", color: priceColor },
  } satisfies ChartConfig;

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
            <LineChart className="size-3.5" />
          </div>
          <span className="text-sm font-semibold">Price History</span>
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
        <ChartContainer config={chartConfig} className={pending ? "opacity-50" : undefined}>
          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-priceThb)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-priceThb)" stopOpacity={0} />
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
              dataKey="priceThb"
              type="monotone"
              fill="url(#priceFill)"
              stroke="var(--color-priceThb)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <span className="text-2xl font-bold tabular-nums">
            {currentPriceThb != null ? formatThb(currentPriceThb) : "—"}
          </span>
          <p className="text-muted-foreground text-xs">
            Not enough price history yet in this window — check back after a reprice or sale.
          </p>
        </div>
      )}
    </div>
  );
}
