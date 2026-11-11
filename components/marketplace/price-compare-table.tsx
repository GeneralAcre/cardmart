"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Plus, Printer, Search, X } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayImage } from "@/lib/card-image";
import { formatGrade } from "@/lib/format";
import { CARD_LANGUAGE_LABELS } from "@/lib/labels";
import { RARITY_SHORT } from "@/lib/rarity";
import { useMoney } from "@/components/currency-provider";
import { cn } from "@/lib/utils";
import type { AssetSummary } from "@/lib/types";
import { useT } from "@/components/landing/language-provider";

export const MAX_COMPARE = 5;
const ANY = "ANY";
const COLUMNS = "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_10rem_6.5rem]";

// Spelled out here (not GRADING_COMPANY_LABELS) because buyers comparing
// prices often know BGS by its company name, Beckett.
const INSTITUTE_LABELS: Record<GradingCompany, string> = {
  PSA: "PSA",
  BGS: "BGS (Beckett)",
  CGC: "CGC",
  RAW: "Ungraded",
};

type Institute = GradingCompany | typeof ANY;

// Same name and set = the same card. Name alone would merge, say, two
// different Charizard ex prints into one row. Also what the marketplace
// grid uses to pick cards for comparison.
export const compareCardKey = (l: { name: string; subtitle: string }) => `${l.name}\u0000${l.subtitle}`;
const cardKey = compareCardKey;

/** Middle asking price; the mean of the two middle ones when the count is even. */
function median(values: number[]) {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface CardOption {
  key: string;
  name: string;
  subtitle: string;
  // The listing whose picture stands for the card: one with a real photo or
  // catalog image when there is one.
  cover: AssetSummary;
  minPrice: number;
  count: number;
}

/** A card's picture, or its generated art when no photo exists. */
function CardThumb({ asset, className, sizes }: { asset: AssetSummary; className?: string; sizes: string }) {
  const image = displayImage(asset);
  return (
    <div className={cn("card-stage relative overflow-hidden rounded-md", className)}>
      {image ? (
        <Image src={image.url} alt="" fill sizes={sizes} className="object-contain p-1" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-1">
          <CardArt
            themeIndex={asset.themeIndex}
            category={asset.category}
            gradingCompany={asset.gradingCompany}
            grade={asset.grade}
            isBlackLabel={asset.isBlackLabel}
            bordered={false}
            showGrade={false}
            className="h-full w-auto rounded-sm"
          />
        </div>
      )}
    </div>
  );
}

// Side-by-side price comparison of up to 5 card + grading-institute
// combinations, computed from the live for-sale listings already on the
// page — so every number here is a real asking price, nothing estimated.
// Cards are picked by picture, since few people remember exact card names.
// The picked cards live with the caller, so cards chosen on the marketplace
// grid arrive here already in the table.
export function PriceCompareTable({
  listings,
  selected,
  onSelectedChange,
}: {
  listings: AssetSummary[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
}) {
  const money = useMoney();
  const [institutes, setInstitutes] = useState<Record<string, Institute>>({});
  const [picking, setPicking] = useState(selected.length === 0);
  const [search, setSearch] = useState("");
  const t = useT();

  const priced = useMemo(() => listings.filter((l) => l.priceThb != null), [listings]);
  const cards = useMemo(() => {
    const byKey = new Map<string, CardOption>();
    for (const l of priced) {
      const key = cardKey(l);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { key, name: l.name, subtitle: l.subtitle, cover: l, minPrice: l.priceThb!, count: 1 });
        continue;
      }
      existing.count += 1;
      existing.minPrice = Math.min(existing.minPrice, l.priceThb!);
      if (!displayImage(existing.cover) && displayImage(l)) existing.cover = l;
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [priced]);
  const cardByKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);

  const query = search.trim().toLowerCase();
  const visibleCards = query
    ? cards.filter((c) => `${c.name} ${c.subtitle}`.toLowerCase().includes(query))
    : cards;
  const rows = selected.filter((key) => cardByKey.has(key)).map((card) => ({ card, institute: institutes[card] ?? ANY }));
  const chosen = new Set(rows.map((r) => r.card));

  const results = rows.map((row) => {
    const matches = priced.filter(
      (l) => cardKey(l) === row.card && (row.institute === ANY || l.gradingCompany === row.institute),
    );
    if (matches.length === 0) return null;
    const prices = matches.map((l) => l.priceThb!);
    const cheapest = matches.reduce((a, b) => (a.priceThb! <= b.priceThb! ? a : b));
    const grades = [...new Set(matches.map((l) => (l.gradingCompany === "RAW" ? t("Raw") : formatGrade(l.grade))))];
    return {
      count: matches.length,
      median: median(prices),
      cheapestId: cheapest.id,
      institute: row.institute,
      cheapest,
      grades,
    };
  });

  const filledMins = results.flatMap((r) => (r ? [r.median] : []));
  const bestPrice = filledMins.length > 1 ? Math.min(...filledMins) : null;

  type Result = NonNullable<(typeof results)[number]>;
  const stats: { label: string; value: (r: Result) => ReactNode; isBest?: (r: Result | null) => boolean; printOnly?: boolean }[] = [
    // The dropdown in each card head does this job on screen; paper needs it as text.
    { label: "Institute", printOnly: true, value: (r) => t(r.institute === ANY ? "All institutes" : INSTITUTE_LABELS[r.institute]) },
    {
      label: "Median price",
      value: (r) => money(r.median),
      isBest: (r) => r != null && bestPrice != null && r.median === bestPrice,
    },
    { label: "Listings", value: (r) => r.count },
    {
      label: "Grades",
      value: (r) => (
        <span className="flex flex-wrap justify-center gap-1.5">
          {r.grades.map((g) => (
            <span key={g} className="bg-muted rounded-md px-2 py-0.5 text-sm font-medium">
              {g}
            </span>
          ))}
        </span>
      ),
    },
    {
      label: "Price trend",
      value: (r) => {
        const { priceDirection: dir, priceChangePct: pct } = r.cheapest;
        if (!dir) return <span className="text-muted-foreground font-normal">—</span>;
        return (
          <span className={dir === "up" ? "text-success" : "text-destructive"}>
            {dir === "up" ? "▲" : "▼"}
            {pct != null ? ` ${Math.abs(pct).toFixed(1)}%` : ""}
          </span>
        );
      },
    },
    { label: "Rarity", value: (r) => (r.cheapest.rarity ? RARITY_SHORT[r.cheapest.rarity] : "—") },
    { label: "Card number", value: (r) => r.cheapest.cardNumber || "—" },
    { label: "Language", value: (r) => t(CARD_LANGUAGE_LABELS[r.cheapest.language]) },
  ];

  // Cheapest card first, so the best deal leads from the left; cards with no listings go last.
  const order = rows
    .map((_, i) => i)
    .sort((a, b) => (results[a]?.median ?? Infinity) - (results[b]?.median ?? Infinity));

  function addCard(card: string) {
    if (chosen.has(card) || rows.length >= MAX_COMPARE) return;
    onSelectedChange([...rows.map((r) => r.card), card]);
    setSearch("");
    setPicking(false);
  }

  function removeRow(card: string) {
    const remaining = rows.map((r) => r.card).filter((c) => c !== card);
    onSelectedChange(remaining);
    if (remaining.length === 0) setPicking(true);
  }

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 && (
        // Paper only: the CardMart wordmark top left, what this is and when it was made on the right.
        <div className="hidden items-end justify-between border-b-2 border-foreground pb-4 print:flex">
          <Image src="/cardmart-logo.png" alt="CardMart" width={484} height={77} unoptimized className="print-logo h-8 w-auto" />
          <div className="text-right">
            <div className="text-lg font-semibold">{t("Compare prices")}</div>
            <div className="text-muted-foreground text-sm">
              {t("Median asking price")}
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            {bestPrice != null ? (
              <>
                <span className="text-success font-semibold">{t("Green")}</span> = {t("lowest price")}
              </>
            ) : (
              t("You can compare up to 5 cards.")
            )}
          </span>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t("Print")}
            </Button>
            <Button onClick={() => setPicking((p) => !p)} disabled={rows.length >= MAX_COMPARE} aria-expanded={picking}>
              <Plus /> {t("Add card")} ({rows.length}/{MAX_COMPARE})
            </Button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        // Head-to-head: one column per card, one row per stat, so the same
        // fact lines up across cards. Scrolls sideways inside the box when
        // five cards do not fit (phones); the label column stays put.
        <div className="bg-card overflow-x-auto rounded-2xl border print:overflow-visible print:break-inside-avoid">
          <div
            className="grid min-w-full"
            style={{ gridTemplateColumns: `minmax(7.5rem,10rem) repeat(${rows.length}, minmax(10.5rem,1fr))` }}
          >
            {/* Card heads */}
            <div className="bg-card sticky left-0 z-10" />
            {order.map((i) => rows[i]).map((row) => {
              const card = cardByKey.get(row.card);
              if (!card) return <div key={row.card} />;
              const institutes = [...new Set(priced.filter((l) => cardKey(l) === row.card).map((l) => l.gradingCompany))];
              return (
                <div key={row.card} className="relative flex flex-col items-center gap-2 p-5 pb-6 text-center print:gap-1 print:p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground absolute top-2 right-2 size-8 print:hidden"
                    onClick={() => removeRow(row.card)}
                    aria-label={t("Remove row")}
                  >
                    <X />
                  </Button>
                  <CardThumb asset={card.cover} sizes="200px" className="h-48 w-36 shrink-0 print:h-32 print:w-24" />
                  <div className="flex max-w-full min-w-0 flex-col">
                    <span className="truncate text-lg font-semibold">{card.name}</span>
                    <span className="text-muted-foreground truncate text-sm">{card.subtitle}</span>
                  </div>
                  <Select value={row.institute} onValueChange={(v) => setInstitutes((prev) => ({ ...prev, [row.card]: v as Institute }))}>
                    <SelectTrigger className="h-10 w-full min-w-0 text-sm print:hidden [&>span]:truncate" aria-label={t("Grading institute")}>
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
              );
            })}

            {/* Stat rows */}
            {stats.map((stat, n) => (
              <Fragment key={stat.label}>
                <div
                  className={cn(
                    "text-muted-foreground sticky left-0 z-10 items-center border-t px-4 py-3.5 text-sm font-medium print:py-2",
                    stat.printOnly ? "hidden print:flex" : "flex",
                    n % 2 === 0 ? "bg-card" : "bg-muted",
                  )}
                >
                  {t(stat.label)}
                </div>
                {order.map((i) => {
                  const row = rows[i];
                  const result = results[i];
                  const best = stat.isBest?.(result) ?? false;
                  return (
                    <div
                      key={row.card}
                      className={cn(
                        "items-center justify-center border-t border-l px-3 py-3.5 text-center text-base font-semibold tabular-nums print:py-2",
                        stat.printOnly ? "hidden print:flex" : "flex",
                        n % 2 === 1 && "bg-muted/50",
                        best && "bg-success/15 text-success ring-success/40 ring-1 ring-inset",
                      )}
                    >
                      {result ? stat.value(result) : <span className="text-muted-foreground font-normal">—</span>}
                    </div>
                  );
                })}
              </Fragment>
            ))}

            {/* Link row */}
            <div className="bg-card sticky left-0 z-10 border-t print:hidden" />
            {order.map((i) => (
              <div key={rows[i].card} className="flex items-center justify-center border-t border-l p-3 print:hidden">
                {results[i] ? (
                  <Button asChild className="w-full">
                    <Link href={`/item/${results[i]!.cheapestId}`}>
                      {t("View cheapest listing")} <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-sm">{t("No listings for this combination.")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {picking && rows.length < MAX_COMPARE && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {rows.length === 0 ? t("Pick cards to compare") : t("Pick another card")}
            </span>
            <div className="relative w-full max-w-60">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search cards")}
                aria-label={t("Search cards")}
                className="h-9 pl-8"
              />
            </div>
          </div>
          {visibleCards.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              {t("No cards match your search.")}
            </p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-6">
              {visibleCards.map((card) => {
                const isChosen = chosen.has(card.key);
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => addCard(card.key)}
                    disabled={isChosen}
                    aria-pressed={isChosen}
                    className={cn(
                      "bg-card group flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors",
                      isChosen ? "border-success/60 opacity-60" : "hover:border-foreground/30",
                    )}
                  >
                    <div className="relative">
                      <CardThumb asset={card.cover} sizes="(max-width: 640px) 30vw, 160px" className="aspect-[3/4] w-full" />
                      {isChosen && (
                        <span className="bg-success-fill text-success-fill-foreground absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-1 text-xs font-medium">{card.name}</span>
                    <span className="text-muted-foreground line-clamp-1 text-[11px]">{card.subtitle}</span>
                    <span className="text-[11px] font-semibold tabular-nums">
                      {t("from {price}", { price: money(card.minPrice) })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
