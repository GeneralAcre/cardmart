"use client";

import { Line, LineChart, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatThb } from "@/lib/format";
import { FULL_SERVICE_PACKAGE_PRICE_THB, THB_PER_USD } from "@/lib/pricing";
import type { PriceStats } from "@/lib/stats-math";
import type { EbayPriceQuote } from "@/lib/ebay";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const tone = (v: number | null) =>
  v == null || Math.abs(v) < 0.05 ? "text-muted-foreground" : v > 0 ? "text-success" : "text-destructive";
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

/** One label-and-value row, like a quote page's summary table. */
function Row({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right">
        {note && <span className="text-muted-foreground truncate text-xs">{note}</span>}
        <span className="font-semibold whitespace-nowrap tabular-nums">{children}</span>
      </span>
    </div>
  );
}

/**
 * A card's key statistics in the picked grade, as one compact table: price
 * moves, all-time high and low and how much it swings (from the same series
 * the chart draws), then supply and demand on eBay and CardMart.
 */
export function KeyStats({
  stats,
  supply,
  cardmartListings,
  sales30d,
  lowestAsk,
  lastSale,
  watchers,
  alerts,
  timeToSell,
  recentSales,
}: {
  stats: PriceStats;
  /** eBay's active listing count for this card and grade, one point per saved day. */
  supply: { t: number; count: number }[];
  cardmartListings: number;
  sales30d: number;
  lowestAsk: number | null;
  lastSale: number | null;
  watchers: number;
  alerts: number;
  /** Median days from listing to sale: this card and grade, or the game as a baseline. */
  timeToSell: { days: number; count: number; scope: "card" | "game" } | null;
  /** The latest CardMart sales in this grade, newest first. */
  recentSales: { id: string; amountThb: number; soldAt: string }[];
}) {
  const { locale, tr: t } = useLanguage();
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "2-digit" });
  const fromHigh =
    stats.high && stats.latest != null && stats.high.price > 0 ? ((stats.latest - stats.high.price) / stats.high.price) * 100 : null;
  const spread = lowestAsk != null && lastSale != null && lastSale > 0 ? ((lowestAsk - lastSale) / lastSale) * 100 : null;

  const lastSupply = supply.at(-1);
  const weekAgo = lastSupply ? [...supply].reverse().find((p) => p.t <= lastSupply.t - 7 * 86_400_000) : undefined;
  const supplyChange =
    lastSupply && weekAgo && weekAgo.count > 0 ? ((lastSupply.count - weekAgo.count) / weekAgo.count) * 100 : null;
  const supplyConfig = { count: { label: t("eBay listings"), color: "var(--compare)" } } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("Key statistics")}</h3>
      {/* Two columns from sm up, split by a divider; each column pads itself so values never touch the next label. */}
      <div className="bg-card grid grid-cols-1 rounded-xl border sm:grid-cols-2">
        <div className="flex flex-col px-4 sm:border-r [&>*:last-child]:border-b-0">
          <Row label={t("7 days")}>
            <span className={tone(stats.change7d)}>{pct(stats.change7d)}</span>
          </Row>
          <Row label={t("30 days")}>
            <span className={tone(stats.change30d)}>{pct(stats.change30d)}</span>
          </Row>
          <Row label={t("1 year")}>
            <span className={tone(stats.change1y)}>{pct(stats.change1y)}</span>
          </Row>
          <Row label={t("Daily swing")} note={stats.volatility == null ? t("Needs a few more days") : undefined}>
            {stats.volatility != null ? `±${stats.volatility.toFixed(1)}%` : "—"}
          </Row>
          <Row
            label={t("All-time high")}
            note={stats.high ? `${fromHigh != null ? `${pct(fromHigh)} · ` : ""}${day(stats.high.t)}` : undefined}
          >
            {stats.high ? formatThb(stats.high.price) : "—"}
          </Row>
          <Row label={t("All-time low")} note={stats.low ? day(stats.low.t) : undefined}>
            {stats.low ? formatThb(stats.low.price) : "—"}
          </Row>
        </div>
        <div className="flex flex-col border-t px-4 sm:border-t-0 [&>*:last-child]:border-b-0">
          <Row
            label={t("For sale on eBay")}
            note={supplyChange != null ? t("{pct} in 7 days", { pct: pct(supplyChange) }) : undefined}
          >
            <span className="flex items-center gap-2">
              {supply.length >= 2 && (
                <ChartContainer config={supplyConfig} className="aspect-auto h-5 w-12">
                  <LineChart data={supply} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Line dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ChartContainer>
              )}
              {lastSupply ? lastSupply.count : "—"}
            </span>
          </Row>
          <Row label={t("For sale on CardMart")}>{cardmartListings}</Row>
          <Row label={t("Sales · 30 days")}>{sales30d}</Row>
          <Row
            label={t("Last sale")}
            note={spread != null ? t("Lowest ask {pct}", { pct: pct(spread) }) : undefined}
          >
            {lastSale != null ? formatThb(lastSale) : "—"}
          </Row>
          <Row
            label={t("Time to sell")}
            note={
              timeToSell
                ? timeToSell.scope === "card"
                  ? t(timeToSell.count === 1 ? "{count} sale" : "Median of {count} sales", { count: timeToSell.count })
                  : t("Average for this game")
                : t("No sales yet")
            }
          >
            {timeToSell ? (timeToSell.days < 1 ? t("Under a day") : t("{days} days", { days: Math.round(timeToSell.days) })) : "—"}
          </Row>
          <Row label={t("Watching / want it")}>
            {watchers} / {alerts}
          </Row>
        </div>
      </div>
      {recentSales.length > 0 && (
        <div className="bg-card rounded-xl border px-4 py-1">
          <p className="text-muted-foreground border-b py-2 text-xs font-medium">{t("Recent CardMart sales")}</p>
          {recentSales.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
              <span className="text-muted-foreground">{day(new Date(sale.soldAt).getTime())}</span>
              <span className="font-semibold tabular-nums">{formatThb(sale.amountThb)}</span>
            </div>
          ))}
        </div>
      )}
      {stats.since != null && (
        <p className="text-muted-foreground text-[11px]">
          {t("Based on {days} days of market prices since {date}.", { days: stats.days, date: day(stats.since) })}
        </p>
      )}
    </div>
  );
}

/**
 * "Is grading worth it?": the ungraded price against PSA 9 and PSA 10, after
 * CardMart's full-service grading package — what a raw copy could be worth
 * once graded, if it gets that grade.
 */
export function GradingValue({ ebay }: { ebay: Record<string, EbayPriceQuote | null | undefined> }) {
  const { tr: t } = useLanguage();
  const thb = (q: EbayPriceQuote | null | undefined) => (q ? Math.round(q.medianPriceUsd * THB_PER_USD) : null);
  const raw = thb(ebay["RAW::"]);
  const rows = [
    { label: "PSA 9", price: thb(ebay["PSA:9:"]) },
    { label: "PSA 10", price: thb(ebay["PSA:10:"]) },
  ];

  return (
    <div className="bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{t("Is grading worth it?")}</h3>
        <p className="text-muted-foreground text-xs">
          {t("An ungraded copy against PSA 9 and PSA 10, after our {fee} grading package. Assumes the card gets that grade.", {
            fee: formatThb(FULL_SERVICE_PACKAGE_PRICE_THB),
          })}
        </p>
      </div>
      {raw == null ? (
        <p className="text-muted-foreground text-sm">{t("No ungraded market price to compare yet.")}</p>
      ) : (
        <div className="flex flex-col divide-y text-sm">
          <div className="flex items-center justify-between py-2">
            <span>{t("Ungraded")}</span>
            <span className="font-semibold tabular-nums">{formatThb(raw)}</span>
          </div>
          {rows.map((row) => {
            const net = row.price != null ? row.price - raw - FULL_SERVICE_PACKAGE_PRICE_THB : null;
            return (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                <span className="flex flex-col">
                  <span>{row.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {row.price != null ? formatThb(row.price) : t("No market price yet")}
                  </span>
                </span>
                {net != null && (
                  <span className="flex flex-col items-end">
                    <span className={cn("font-semibold tabular-nums", tone(net))}>
                      {net >= 0 ? "+" : "−"}
                      {formatThb(Math.abs(net))}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {net > 0 ? t("Worth grading") : t("Not worth it at this grade")}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
