"use client";

import { formatThb } from "@/lib/format";
import { FULL_SERVICE_PACKAGE_PRICE_THB, THB_PER_USD } from "@/lib/pricing";
import type { PriceStats } from "@/lib/stats-math";
import type { EbayPriceQuote } from "@/lib/ebay";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const tone = (v: number | null) =>
  v == null || Math.abs(v) < 0.05 ? "text-muted-foreground" : v > 0 ? "text-success" : "text-destructive";
// A non-breaking space keeps an empty note line at full height.
const NBSP = " ";
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

/**
 * A card's key statistics in the picked grade, as one compact table: price
 * moves, all-time high and low and how much it swings (from the same series
 * the chart draws), then supply and demand on eBay and CardMart.
 */
export function KeyStats({
  stats,
  watchers,
  lowestAsk,
  lastSale,
  recentSales,
}: {
  stats: PriceStats;
  supply: { t: number; count: number }[];
  cardmartListings: number;
  sales30d: number;
  watchers: number;
  alerts: number;
  timeToSell: { days: number; count: number; scope: "card" | "game" } | null;
  lowestAsk: number | null;
  lastSale: number | null;
  /** Median days from listing to sale: this card and grade, or the game as a baseline. */
  /** The latest CardMart sales in this grade, newest first. */
  recentSales: { id: string; amountThb: number; soldAt: string }[];
}) {
  const { locale, tr: t } = useLanguage();
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "2-digit" });
  const spread = lowestAsk != null && lastSale != null && lastSale > 0 ? ((lowestAsk - lastSale) / lastSale) * 100 : null;

  const items: { label: string; value: React.ReactNode; note?: string }[] = [
    { label: t("Change · 7 days"), value: <span className={tone(stats.change7d)}>{pct(stats.change7d)}</span> },
    { label: t("Change · 30 days"), value: <span className={tone(stats.change30d)}>{pct(stats.change30d)}</span> },
    {
      label: t("All-time high"),
      value: stats.high ? formatThb(stats.high.price) : "—",
    },
    { label: t("All-time low"), value: stats.low ? formatThb(stats.low.price) : "—" },
    { label: t("Watching"), value: watchers },
    {
      label: t("Last sale"),
      value: lastSale != null ? formatThb(lastSale) : "—",
      note: spread != null ? t("Lowest ask {pct}", { pct: pct(spread) }) : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="self-start text-left text-lg font-semibold">{t("Key statistics")}</h3>

      <div className="bg-border grid auto-rows-fr grid-cols-2 gap-px overflow-hidden rounded-xl border">
        {items.map((item) => (
          <div key={item.label} className="bg-card flex min-w-0 flex-col items-center justify-center gap-2 px-3.5 py-4 text-center">
            <span className="text-muted-foreground truncate text-sm">{item.label}</span>
            <span className={cn("truncate text-xl leading-tight font-bold tabular-nums sm:text-2xl", item.value === "—" && "text-muted-foreground font-normal")}>
              {item.value}
            </span>
            {item.note && <span className="text-muted-foreground truncate text-xs">{item.note}</span>}
          </div>
        ))}
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
