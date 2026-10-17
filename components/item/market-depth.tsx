"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatThb } from "@/lib/format";
import { useLanguage } from "@/components/landing/language-provider";

export interface HistoryRow {
  t: number;
  median: number;
  low: number;
  high: number;
  count: number;
}

const ROWS_SHOWN = 10;

/** Yahoo-style historical data: one row per saved day, newest first, downloadable as CSV. */
export function HistoricalData({ rows, fileName }: { rows: HistoryRow[]; fileName: string }) {
  const { locale, tr: t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return null;
  const newestFirst = [...rows].sort((a, b) => b.t - a.t);
  const shown = showAll ? newestFirst : newestFirst.slice(0, ROWS_SHOWN);
  const day = (ms: number) => new Date(ms).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" });

  function download() {
    const lines = [
      "date,median_thb,low_thb,high_thb,ebay_listings",
      ...newestFirst.map((r) => [new Date(r.t).toISOString().slice(0, 10), r.median, r.low, r.high, r.count].join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("Historical data")}</h3>
        <Button variant="outline" size="sm" onClick={download}>
          <Download /> {t("Download CSV")}
        </Button>
      </div>
      <div className="bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-[11px] font-semibold tracking-wide uppercase">
              <th className="px-3 py-2 font-semibold">{t("Date")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("Median")}</th>
              <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">{t("Low")}</th>
              <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">{t("High")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("Listings")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((r) => (
              <tr key={r.t}>
                <td className="text-muted-foreground px-3 py-2">{day(r.t)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatThb(r.median)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{formatThb(r.low)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{formatThb(r.high)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {newestFirst.length > ROWS_SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-muted-foreground hover:text-foreground w-full border-t py-2 text-xs transition-colors"
          >
            {showAll ? t("Show less") : t("Show all {count} days", { count: newestFirst.length })}
          </button>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">
        {t("eBay's daily median, lowest and highest asking price for this card and grade, in baht, and how many listings matched.")}
      </p>
    </div>
  );
}
