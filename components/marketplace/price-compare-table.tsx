"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Plus, Search, X } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayImage } from "@/lib/card-image";
import { formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssetSummary } from "@/lib/types";
import { useT } from "@/components/landing/language-provider";

export const MAX_COMPARE = 5;
const ANY = "ANY";
const COLUMNS = "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_9rem_4.5rem]";

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
      min: Math.min(...prices),
      max: Math.max(...prices),
      cheapestId: cheapest.id,
      grades,
    };
  });

  const filledMins = results.flatMap((r) => (r ? [r.min] : []));
  const bestPrice = filledMins.length > 1 ? Math.min(...filledMins) : null;

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
        // One grid per comparison instead of a <table>: on phones each row
        // stacks into its own card, so nothing ever needs a sideways scroll;
        // from sm up the same grid lines up into table columns.
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className={cn("text-muted-foreground hidden gap-3 border-b px-3 py-2.5 text-xs font-medium sm:grid", COLUMNS)}>
            <span>{t("Card")}</span>
            <span>{t("Institute")}</span>
            <span>{t("Grades")}</span>
            <span className="text-right">{t("Price")}</span>
            <span />
          </div>
          <div className="divide-y">
            {rows.map((row, i) => {
              const card = cardByKey.get(row.card);
              if (!card) return null;
              const result = results[i];
              const institutes = [...new Set(priced.filter((l) => cardKey(l) === row.card).map((l) => l.gradingCompany))];
              const isBest = result != null && bestPrice != null && result.min === bestPrice;
              return (
                <div key={row.card} className={cn("grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:items-center", COLUMNS)}>
                  <div className="row-span-4 flex items-start gap-3 sm:row-span-1 sm:col-span-1 sm:items-center">
                    <CardThumb asset={card.cover} sizes="48px" className="h-16 w-12 shrink-0" />
                    <div className="hidden min-w-0 flex-col sm:flex">
                      <span className="truncate text-sm font-medium">{card.name}</span>
                      <span className="text-muted-foreground truncate text-xs">{card.subtitle}</span>
                    </div>
                  </div>

                  {/* Phones: name and remove button beside the picture. */}
                  <div className="flex min-w-0 items-start justify-between gap-2 sm:hidden">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{card.name}</span>
                      <span className="text-muted-foreground truncate text-xs">{card.subtitle}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground size-8 shrink-0"
                      onClick={() => removeRow(row.card)}
                      aria-label={t("Remove row")}
                    >
                      <X />
                    </Button>
                  </div>

                  <Select value={row.institute} onValueChange={(v) => setInstitutes((prev) => ({ ...prev, [row.card]: v as Institute }))}>
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

                  {result ? (
                    <>
                      <span className="text-muted-foreground truncate text-xs">
                        <span className="sm:hidden">{t("Grades:")} </span>
                        {result.grades.join(", ")}
                      </span>
                      <div className="flex items-center justify-between gap-2 sm:block sm:text-right">
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
                    <span className="text-muted-foreground text-xs sm:col-span-2">{t("No listings for this combination.")}</span>
                  )}

                  <div className="hidden items-center justify-end sm:flex">
                    {result && (
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
                      onClick={() => removeRow(row.card)}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPicking((p) => !p)}
              disabled={rows.length >= MAX_COMPARE}
              aria-expanded={picking}
            >
              <Plus /> {t("Add card")} ({rows.length}/{MAX_COMPARE})
            </Button>
            {bestPrice != null && (
              <span className="text-muted-foreground text-xs">
                <span className="text-success font-medium">{t("Green")}</span> = {t("lowest price")}
              </span>
            )}
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
            <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
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
                        <span className="bg-success text-background absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-1 text-xs font-medium">{card.name}</span>
                    <span className="text-muted-foreground line-clamp-1 text-[11px]">{card.subtitle}</span>
                    <span className="text-[11px] font-semibold tabular-nums">
                      {t("from {price}", { price: formatThb(card.minPrice) })}
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
