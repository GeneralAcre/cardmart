"use client";

import { useEffect, useRef, useState } from "react";
import { Anchor, LayoutGrid, PackageSearch, Scale, Sparkles, SlidersHorizontal, Vault as VaultIcon } from "lucide-react";
import type { CardGame } from "@prisma/client";

import { FilterBar } from "@/components/marketplace/filter-bar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { TrendingStrip, type TrendingListing } from "@/components/marketplace/trending-strip";
import { PriceCompareTable } from "@/components/marketplace/price-compare-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CARD_GAME_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { EMPTY_FILTERS, type AssetSummary, type MarketplaceFilterState } from "@/lib/types";

const CATEGORY_TILES: { category: CardGame | "ALL" | "VAULT"; label: string; icon: typeof LayoutGrid }[] = [
  { category: "ALL", label: "All", icon: LayoutGrid },
  { category: "POKEMON", label: CARD_GAME_LABELS.POKEMON, icon: Sparkles },
  { category: "ONE_PIECE", label: CARD_GAME_LABELS.ONE_PIECE, icon: Anchor },
  { category: "VAULT", label: "In Vault", icon: VaultIcon },
];

function buildQuery(filters: MarketplaceFilterState) {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  filters.games.forEach((g) => sp.append("game", g));
  filters.gradingCompanies.forEach((c) => sp.append("gradingCompany", c));
  filters.grades.forEach((g) => sp.append("grade", String(g)));
  if (filters.blackLabelOnly) sp.set("blackLabel", "true");
  if (filters.priceMin != null) sp.set("priceMin", String(filters.priceMin));
  if (filters.priceMax != null) sp.set("priceMax", String(filters.priceMax));
  if (filters.vaultedStatus !== "ALL") sp.set("vaultedStatus", filters.vaultedStatus);
  return sp.toString();
}

function countActiveFilters(filters: MarketplaceFilterState): number {
  return (
    (filters.q ? 1 : 0) +
    filters.games.length +
    filters.gradingCompanies.length +
    filters.grades.length +
    (filters.blackLabelOnly ? 1 : 0) +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.vaultedStatus !== "ALL" ? 1 : 0)
  );
}

export function MarketplaceExplorer({
  initialListings,
  trendingWeek,
  trendingMonth,
}: {
  initialListings: AssetSummary[];
  trendingWeek: TrendingListing[];
  trendingMonth: TrendingListing[];
}) {
  const [filters, setFilters] = useState<MarketplaceFilterState>(EMPTY_FILTERS);
  const [listings, setListings] = useState<AssetSummary[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const isFirstRender = useRef(true);
  const activeFilterCount = countActiveFilters(filters);
  const t = useT();
  const itemCount = t(listings.length === 1 ? "{count} item" : "{count} items", { count: listings.length });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const query = buildQuery(filters);
        const res = await fetch(`/api/listings${query ? `?${query}` : ""}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setListings(data.listings);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [filters]);

  function selectCategoryTile(tile: (typeof CATEGORY_TILES)[number]["category"]) {
    if (tile === "ALL") {
      setFilters({ ...filters, games: [] });
    } else if (tile === "VAULT") {
      setFilters({ ...filters, vaultedStatus: filters.vaultedStatus === "IN_VAULT" ? "ALL" : "IN_VAULT" });
    } else {
      const isActive = filters.games.includes(tile);
      setFilters({ ...filters, games: isActive ? [] : [tile] });
    }
  }

  function isCategoryTileActive(tile: (typeof CATEGORY_TILES)[number]["category"]) {
    if (tile === "ALL") return filters.games.length === 0 && filters.vaultedStatus !== "IN_VAULT";
    if (tile === "VAULT") return filters.vaultedStatus === "IN_VAULT";
    return filters.games.includes(tile);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* Desktop: filters sit in a sticky sidebar that runs the full height
          of the page — alongside Trending and the category tiles too, not
          just the results grid — so they stay reachable while scrolling. */}
      <div className="hidden lg:block">
        <div className="sticky top-4">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Mobile: filters live behind a sheet instead of pushing every
          result below a full-height filter panel on first load. */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader>
            <SheetTitle>{t("Filters")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <FilterBar filters={filters} onChange={setFilters} className="border-0 p-0 shadow-none" />
          </div>
          <SheetFooter>
            <Button onClick={() => setFilterSheetOpen(false)} disabled={loading}>
              {loading ? t("Searching…") : t("Show {items}", { items: itemCount })}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-6">
        <TrendingStrip week={trendingWeek} month={trendingMonth} />

        {/* A storefront-style "pick what you're into" row — the sidebar/sheet
            filters above still cover everything in depth, but this gives the
            page an inviting entry point instead of opening straight into a
            dense filter form. */}
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {CATEGORY_TILES.map(({ category, label, icon: Icon }) => {
            const active = isCategoryTileActive(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => selectCategoryTile(category)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-foreground hover:bg-accent border-border",
                )}
              >
                <Icon className="size-4" />
                {t(label)}
              </button>
            );
          })}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {loading ? t("Searching…") : itemCount}
            </p>
            <div className="flex items-center gap-2">
              {initialListings.some((listing) => listing.priceThb != null) && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Scale /> {t("Compare prices")}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl">
                    <DialogHeader>
                      <DialogTitle>{t("Compare prices")}</DialogTitle>
                      <DialogDescription>{t("Compare asking prices across cards and grading institutes.")}</DialogDescription>
                    </DialogHeader>
                    <PriceCompareTable listings={initialListings} />
                  </DialogContent>
                </Dialog>
              )}
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFilterSheetOpen(true)}>
                <SlidersHorizontal /> {t("Filters")}
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 size-4 rounded-full p-0 text-[10px]">{activeFilterCount}</Badge>
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4.6] w-full rounded-xl" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
              <PackageSearch className="size-8" />
              <p className="text-sm">{t("No items match your filters. Try widening your search.")}</p>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  {t("Clear filters")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {listings.map((asset) => (
                <ListingCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </div>

        {/* Compares across everything listed, not just the filtered results —
            filters narrow what you browse, not which cards you can compare. */}
      </div>
    </div>
  );
}
