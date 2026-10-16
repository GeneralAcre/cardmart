"use client";

import { formatThb } from "@/lib/format";
import { FULL_SERVICE_PACKAGE_PRICE_THB, THB_PER_USD } from "@/lib/pricing";
import type { PriceStats } from "@/lib/stats-math";
import type { EbayPriceQuote } from "@/lib/ebay";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const tone = (v: number | null) =>
  v == null || Math.abs(v) < 0.05 ? "text-muted-foreground" : v > 0 ? "text-success" : "text-destructive";
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

function Stat({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="bg-card flex flex-col gap-0.5 p-3">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", className)}>{value}</span>
      {sub && <span className="text-muted-foreground text-[11px]">{sub}</span>}
    </div>
  );
}

/**
 * A card's ticker-style statistics in the picked grade: price moves, all-time
 * high and low, how much it swings day to day, and how liquid it is on
 * CardMart. Every figure comes from the same series the chart above draws.
 */
export function CardStats({
  stats,
  liveListings,
  sales30d,
  lowestAsk,
  lastSale,
}: {
  stats: PriceStats;
  liveListings: number;
  sales30d: number;
  lowestAsk: number | null;
  lastSale: number | null;
}) {
  const { locale, tr: t } = useLanguage();
  const day = (ms: number) => new Date(ms).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "2-digit" });
  const spread = lowestAsk != null && lastSale != null && lastSale > 0 ? ((lowestAsk - lastSale) / lastSale) * 100 : null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("Card stats")}</h3>
      <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4">
        <Stat label={t("7 days")} value={pct(stats.change7d)} className={tone(stats.change7d)} />
        <Stat label={t("30 days")} value={pct(stats.change30d)} className={tone(stats.change30d)} />
        <Stat label={t("1 year")} value={pct(stats.change1y)} className={tone(stats.change1y)} />
        <Stat
          label={t("Daily swing")}
          value={stats.volatility != null ? `±${stats.volatility.toFixed(1)}%` : "—"}
          sub={stats.volatility != null ? t("Typical move per day") : t("Needs a few more days")}
        />
        <Stat
          label={t("All-time high")}
          value={stats.high ? formatThb(stats.high.price) : "—"}
          sub={stats.high ? day(stats.high.t) : undefined}
        />
        <Stat
          label={t("All-time low")}
          value={stats.low ? formatThb(stats.low.price) : "—"}
          sub={stats.low ? day(stats.low.t) : undefined}
        />
        <Stat label={t("Live listings")} value={String(liveListings)} sub={t("On CardMart, this grade")} />
        <Stat
          label={t("Sales · 30 days")}
          value={String(sales30d)}
          sub={
            spread != null
              ? t("Lowest ask {pct} vs last sale", { pct: pct(spread) })
              : lastSale != null
                ? t("Last sale {price}", { price: formatThb(lastSale) })
                : t("No sales yet")
          }
        />
      </div>
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
