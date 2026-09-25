"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Scale, X } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssetSummary } from "@/lib/types";

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
    const grades = [...new Set(matches.map((l) => (l.gradingCompany === "RAW" ? "Raw" : formatGrade(l.grade))))];
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
      <div className="flex items-center gap-2">
        <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
          <Scale className="size-3.5" />
        </div>
        <h2 className="text-lg font-semibold">Compare Prices</h2>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          Up to {MAX_ROWS} cards &middot; by grading institute
        </span>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table className="min-w-[640px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[38%]">Card</TableHead>
              <TableHead className="w-[22%]">Institute</TableHead>
              <TableHead>Grades</TableHead>
              <TableHead className="w-40 text-right">Price</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const result = results[i];
              const institutes = [
                ...new Set(priced.filter((l) => l.name === row.name).map((l) => l.gradingCompany)),
              ];
              return (
                <TableRow key={row.key}>
                  <TableCell>
                    <Select
                      value={row.name ?? ""}
                      onValueChange={(name) => updateRow(row.key, { name, institute: ANY })}
                    >
                      <SelectTrigger size="sm" className="w-full [&>span]:truncate" aria-label="Card name">
                        <SelectValue placeholder="Select a card…" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.institute}
                      onValueChange={(v) => updateRow(row.key, { institute: v as CompareRow["institute"] })}
                      disabled={!row.name}
                    >
                      <SelectTrigger size="sm" className="w-full [&>span]:truncate" aria-label="Grading institute">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>All institutes</SelectItem>
                        {(Object.keys(INSTITUTE_LABELS) as GradingCompany[])
                          .filter((g) => institutes.includes(g))
                          .map((g) => (
                            <SelectItem key={g} value={g}>
                              {INSTITUTE_LABELS[g]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {result?.kind === "stats" ? (
                    <>
                      <TableCell className="truncate text-xs">{result.grades.join(", ")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div
                          className={cn(
                            "font-semibold",
                            bestPrice != null && result.min === bestPrice && "text-success",
                          )}
                        >
                          {formatThb(result.min)}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {result.count > 1
                            ? `up to ${formatThb(result.max)} · ${result.count} listings`
                            : "1 listing"}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={2} className="text-muted-foreground truncate text-xs">
                      {result ? "No listings for this combination." : "Pick a card to compare."}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end">
                      {result?.kind === "stats" && (
                        <Button asChild variant="ghost" size="icon" className="size-8">
                          <Link href={`/item/${result.cheapestId}`} aria-label="View cheapest listing">
                            <ArrowRight />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-8"
                        onClick={() => removeRow(row.key)}
                        aria-label="Remove row"
                      >
                        <X />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          <Button variant="ghost" size="sm" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
            <Plus /> Add card ({rows.length}/{MAX_ROWS})
          </Button>
          {bestPrice != null && (
            <span className="text-muted-foreground text-xs">
              <span className="text-success font-medium">Green</span> = lowest price
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
