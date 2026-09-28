"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, X } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssetSummary } from "@/lib/types";
import { useT } from "@/components/landing/language-provider";

const MAX_ROWS = 5;
const ANY = "ANY";

// Spelled out here (not GRADING_COMPANY_LABELS) because buyers comparing
// prices often know BGS by its company name, Beckett.
const INSTITUTE_LABELS: Record<GradingCompany, string> = {
  PSA: "PSA",
  BGS: "BGS (Beckett)",
  CGC: "CGC",
  RAW: "Raw / Ungraded",
};

interface CompareRow {
  key: number;
  name: string | null;
  institute: GradingCompany | typeof ANY;
}

// Side-by-side price comparison of up to 5 card + grading-institute
// combinations, computed from the live for-sale listings already on the
// page — so every number here is a real asking price, nothing estimated.
export function PriceCompareTable({ listings }: { listings: AssetSummary[] }) {
  const [rows, setRows] = useState<CompareRow[]>([{ key: 0, name: null, institute: ANY }]);
  const [nextKey, setNextKey] = useState(1);
  const t = useT();

  const priced = useMemo(() => listings.filter((l) => l.priceThb != null), [listings]);
  const cardNames = useMemo(
    () => [...new Set(priced.map((l) => l.name))].sort((a, b) => a.localeCompare(b)),
    [priced],
  );

  const results = rows.map((row) => {
    if (!row.name) return null;
    const matches = priced.filter(
      (l) => l.name === row.name && (row.institute === ANY || l.gradingCompany === row.institute),
    );
    if (matches.length === 0) return { kind: "empty" } as const;
    const prices = matches.map((l) => l.priceThb!);
    const cheapest = matches.reduce((a, b) => (a.priceThb! <= b.priceThb! ? a : b));
    const grades = [...new Set(matches.map((l) => (l.gradingCompany === "RAW" ? t("Raw") : formatGrade(l.grade))))];
    return {
      kind: "stats",
      count: matches.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      cheapestId: cheapest.id,
      grades,
    } as const;
  });

  const filledMins = results.flatMap((r) => (r?.kind === "stats" ? [r.min] : []));
  const bestPrice = filledMins.length > 1 ? Math.min(...filledMins) : null;

  function updateRow(key: number, patch: Partial<CompareRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, { key: nextKey, name: null, institute: ANY }]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length === 1 ? [{ key: nextKey, name: null, institute: ANY }] : prev.filter((r) => r.key !== key)));
    setNextKey((k) => k + 1);
  }

  if (cardNames.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* One grid per comparison instead of a <table>: on phones each row
          stacks into its own card (pickers side by side, result underneath),
          so nothing ever needs a sideways scroll; from sm up the same grid
          lines up into table columns under a shared header. */}
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="text-muted-foreground hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_9rem_4.5rem] gap-3 border-b px-3 py-2.5 text-xs font-medium sm:grid">
          <span>{t("Card")}</span>
          <span>{t("Institute")}</span>
          <span>{t("Grades")}</span>
          <span className="text-right">{t("Price")}</span>
          <span />
        </div>
        <div className="divide-y">
          {rows.map((row, i) => {
            const result = results[i];
            const institutes = [
              ...new Set(priced.filter((l) => l.name === row.name).map((l) => l.gradingCompany)),
            ];
            const isBest = result?.kind === "stats" && bestPrice != null && result.min === bestPrice;
            return (
              <div
                key={row.key}
                className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_9rem_4.5rem] sm:items-center sm:gap-3"
              >
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums sm:hidden">{i + 1}</span>
                  <Select
                    value={row.name ?? ""}
                    onValueChange={(name) => updateRow(row.key, { name, institute: ANY })}
                  >
                    <SelectTrigger size="sm" className="w-full min-w-0 [&>span]:truncate" aria-label={t("Card name")}>
                      <SelectValue placeholder={t("Select a card…")} />
                    </SelectTrigger>
                    <SelectContent>
                      {cardNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-8 shrink-0 sm:hidden"
                    onClick={() => removeRow(row.key)}
                    aria-label={t("Remove row")}
                  >
                    <X />
                  </Button>
                </div>

                <div className="col-span-2 pl-6 sm:col-span-1 sm:pl-0">
                  <Select
                    value={row.institute}
                    onValueChange={(v) => updateRow(row.key, { institute: v as CompareRow["institute"] })}
                    disabled={!row.name}
                  >
                    <SelectTrigger size="sm" className="w-full min-w-0 [&>span]:truncate" aria-label={t("Grading institute")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>{t("All institutes")}</SelectItem>
                      {(Object.keys(INSTITUTE_LABELS) as GradingCompany[])
                        .filter((g) => institutes.includes(g))
                        .map((g) => (
                          <SelectItem key={g} value={g}>
                            {t(INSTITUTE_LABELS[g])}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {result?.kind === "stats" ? (
                  <>
                    <span className="text-muted-foreground col-span-2 truncate pl-6 text-xs sm:col-span-1 sm:pl-0">
                      <span className="sm:hidden">{t("Grades:")} </span>
                      {result.grades.join(", ")}
                    </span>
                    <div className="col-span-2 flex items-center justify-between gap-2 pl-6 sm:col-span-1 sm:block sm:pl-0 sm:text-right">
                      <div className="tabular-nums">
                        <div className={cn("font-semibold", isBest && "text-success")}>{formatThb(result.min)}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {result.count > 1
                            ? t("up to {max} · {count} listings", { max: formatThb(result.max), count: result.count })
                            : t("1 listing")}
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="sm:hidden">
                        <Link href={`/item/${result.cheapestId}`}>
                          {t("Cheapest")} <ArrowRight />
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground col-span-2 pl-6 text-xs sm:pl-0">
                    {result ? t("No listings for this combination.") : t("Pick a card to compare.")}
                  </span>
                )}

                <div className="hidden items-center justify-end sm:flex">
                  {result?.kind === "stats" && (
                    <Button asChild variant="ghost" size="icon" className="size-8">
                      <Link href={`/item/${result.cheapestId}`} aria-label={t("View cheapest listing")}>
                        <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-8"
                    onClick={() => removeRow(row.key)}
                    aria-label={t("Remove row")}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          <Button variant="ghost" size="sm" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
            <Plus /> {t("Add card")} ({rows.length}/{MAX_ROWS})
          </Button>
          {bestPrice != null && (
            <span className="text-muted-foreground text-xs">
              <span className="text-success font-medium">{t("Green")}</span> = {t("lowest price")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
