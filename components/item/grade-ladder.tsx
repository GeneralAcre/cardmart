import { Layers } from "lucide-react";

import type { EbayPriceQuote } from "@/lib/ebay";
import { formatDate, formatGrade, formatThb } from "@/lib/format";
import { THB_PER_USD } from "@/lib/pricing";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export interface GradeTier {
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
}

export const tierKey = (t: GradeTier) => `${t.gradingCompany}:${t.grade ?? ""}:${t.isBlackLabel ? "BL" : ""}`;

/** The grades every card gets a row for, plus whichever one this listing is. */
export const BASE_TIERS: GradeTier[] = [
  { gradingCompany: "RAW", grade: null, isBlackLabel: false },
  { gradingCompany: "PSA", grade: 9, isBlackLabel: false },
  { gradingCompany: "PSA", grade: 10, isBlackLabel: false },
];

export function ladderTiers(current: GradeTier): GradeTier[] {
  const tiers = BASE_TIERS.some((t) => tierKey(t) === tierKey(current)) ? BASE_TIERS : [...BASE_TIERS, current];
  // Raw first, then by grade.
  return [...tiers].sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || Number(a.isBlackLabel) - Number(b.isBlackLabel));
}

function tierLabel(t: GradeTier, raw: string) {
  if (t.gradingCompany === "RAW") return raw;
  return `${t.gradingCompany} ${formatGrade(t.grade)}${t.isBlackLabel ? " Black Label" : ""}`;
}

/**
 * "Price by grade" for one card: what each grade costs on CardMart (cheapest
 * listing, latest sale) and on eBay (exact-match median asking price), with
 * how many times the raw price each grade goes for — the first thing a
 * collector checks before paying up for a higher grade. Below it, the card's
 * latest completed CardMart sales in any grade.
 */
export async function GradeLadder({
  current,
  listings,
  sales,
  ebay,
}: {
  current: GradeTier;
  listings: (GradeTier & { priceThb: number })[];
  sales: (GradeTier & { id: string; amountThb: number; soldAt: Date })[];
  ebay: Record<string, EbayPriceQuote | null>;
}) {
  const t = await getT();
  const rows = ladderTiers(current).map((tier) => {
    const key = tierKey(tier);
    const asks = listings.filter((l) => tierKey(l) === key).map((l) => l.priceThb);
    const lastSale = sales.find((s) => tierKey(s) === key);
    const quote = ebay[key];
    const ebayThb = quote ? Math.round(quote.medianPriceUsd * THB_PER_USD) : null;
    return {
      key,
      label: tierLabel(tier, t("Raw")),
      lowestAsk: asks.length ? Math.min(...asks) : null,
      lastSale: lastSale?.amountThb ?? null,
      ebayThb,
      ebayCount: quote?.itemCount ?? 0,
      // One figure per grade to compare across rows: a real sale beats an asking price.
      reference: lastSale?.amountThb ?? ebayThb ?? (asks.length ? Math.min(...asks) : null),
    };
  });
  const rawRef = rows.find((r) => r.key === tierKey(BASE_TIERS[0]))?.reference ?? null;
  const currentKey = tierKey(current);
  const recent = sales.slice(0, 5);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-md">
          <Layers className="size-3.5" />
        </div>
        <h2 className="eyebrow text-foreground text-sm">{t("Price by grade")}</h2>
      </div>

      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="text-muted-foreground hidden grid-cols-[1fr_repeat(3,minmax(0,1fr))_4.5rem] gap-3 border-b px-4 py-2.5 text-xs sm:grid">
          <span>{t("Grade")}</span>
          <span className="text-right">{t("CardMart · lowest")}</span>
          <span className="text-right">{t("CardMart · last sale")}</span>
          <span className="text-right">{t("eBay · median ask")}</span>
          <span className="text-right">{t("vs raw")}</span>
        </div>
        <ul className="divide-y">
          {rows.map((r) => {
            const multiple = rawRef && r.reference && r.key !== tierKey(BASE_TIERS[0]) ? r.reference / rawRef : null;
            return (
              <li
                key={r.key}
                className={cn(
                  "grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[1fr_repeat(3,minmax(0,1fr))_4.5rem] sm:items-center",
                  r.key === currentKey && "bg-muted/50",
                )}
              >
                <span className="col-span-2 flex items-center gap-2 font-medium sm:col-span-1">
                  {r.label}
                  {r.key === currentKey && (
                    <span className="bg-foreground text-background rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      {t("This card")}
                    </span>
                  )}
                </span>
                <Cell label={t("CardMart · lowest")} value={r.lowestAsk != null ? formatThb(r.lowestAsk) : null} />
                <Cell label={t("CardMart · last sale")} value={r.lastSale != null ? formatThb(r.lastSale) : null} />
                <Cell
                  label={t("eBay · median ask")}
                  value={r.ebayThb != null ? `≈ ${formatThb(r.ebayThb)}` : null}
                  hint={r.ebayCount ? t("{count} listings", { count: r.ebayCount }) : undefined}
                />
                <Cell label={t("vs raw")} value={multiple != null ? `${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}×` : null} />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("Recent sales on CardMart")}</h3>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("No completed sales of this card yet.")}</p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{formatThb(s.amountThb)}</span>
                  <span className="text-muted-foreground">{tierLabel(s, t("Raw"))}</span>
                </span>
                <span className="text-muted-foreground text-xs">{formatDate(s.soldAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-muted-foreground text-[11px]">
        {t("Same card and set in every grade. “vs raw” compares each grade's latest sale (or eBay asking price) with the raw card's.")}
      </p>
    </section>
  );
}

function Cell({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <span className="flex flex-col sm:items-end">
      <span className="text-muted-foreground text-[11px] sm:hidden">{label}</span>
      <span className={cn("tabular-nums", value == null && "text-muted-foreground")}>{value ?? "—"}</span>
      {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
    </span>
  );
}
