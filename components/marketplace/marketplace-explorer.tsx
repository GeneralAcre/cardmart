"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Anchor, Grid3x3, LayoutGrid, PackageSearch, Scale, Search, Sparkles, SlidersHorizontal, Vault as VaultIcon, X } from "lucide-react";
import type { CardGame } from "@prisma/client";

import { FilterBar } from "@/components/marketplace/filter-bar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { TrendingStrip, type TrendingListing } from "@/components/marketplace/trending-strip";
import { PriceCompareTable } from "@/components/marketplace/price-compare-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type SortKey = "recent" | "price-asc" | "price-desc";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently Listed" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

type Density = "comfortable" | "compact";

function buildQuery(filters: MarketplaceFilterState) {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  filters.games.forEach((g) => sp.append("game", g));
  filters.languages.forEach((l) => sp.append("language", l));
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
    filters.languages.length +
    filters.gradingCompanies.length +
    filters.grades.length +
    (filters.blackLabelOnly ? 1 : 0) +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.vaultedStatus !== "ALL" ? 1 : 0)
  );
}

// Listings come back newest first, so "recent" keeps that order; the price
// sorts push unpriced listings to the end either way.
function sortListings(listings: AssetSummary[], sort: SortKey): AssetSummary[] {
  if (sort === "recent") return listings;
  const dir = sort === "price-asc" ? 1 : -1;
  return [...listings].sort((a, b) => {
    if (a.priceThb == null) return b.priceThb == null ? 0 : 1;
    if (b.priceThb == null) return -1;
    return (a.priceThb - b.priceThb) * dir;
  });
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");
  const [density, setDensity] = useState<Density>("comfortable");
  const isFirstRender = useRef(true);
  const activeFilterCount = countActiveFilters(filters);
  const t = useT();
  const itemCount = t(listings.length === 1 ? "{count} item" : "{count} items", { count: listings.length });
  const sortedListings = useMemo(() => sortListings(listings, sort), [listings, sort]);

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
        // A failed search keeps the current results instead of trying to
        // parse an error page as JSON.
        if (!res.ok) throw new Error(`Listing search failed (${res.status})`);
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

  const gridClass = cn(
    "grid gap-3 sm:gap-4",
    density === "comfortable"
      ? sidebarOpen
        ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      : sidebarOpen
        ? "grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8",
  );

  const filterCountBadge =
    activeFilterCount > 0 ? (
      <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[10px] font-bold">
        {activeFilterCount}
      </span>
    ) : null;

  return (
    <div className="flex flex-col">
      {/* Toolbar: filters toggle, search, result count, sort, density. */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4 sm:gap-3">
        <Button
          variant="outline"
          className="hidden h-10 rounded-lg lg:inline-flex"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
        >
          <SlidersHorizontal /> {t("Filters")} {filterCountBadge}
        </Button>
        <Button variant="outline" className="h-10 rounded-lg lg:hidden" onClick={() => setFilterSheetOpen(true)}>
          <SlidersHorizontal /> {t("Filters")} {filterCountBadge}
        </Button>

        <div className="relative order-last w-full sm:order-none sm:w-auto sm:flex-1 lg:max-w-xl">
          <Search className="text-muted-foreground absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder={t("Search name, card number (215/203), set or seller…")}
            className="bg-card placeholder:text-muted-foreground focus-visible:border-foreground/30 h-10 w-full rounded-lg border pl-10 pr-9 text-sm outline-none transition-colors"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, q: "" })}
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
              aria-label={t("Clear search")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <p className="text-muted-foreground hidden text-sm whitespace-nowrap md:block">
            {loading ? (
              t("Searching…")
            ) : (
              <>
                {t("Latest")} <span className="text-foreground font-semibold">{listings.length}</span>{" "}
                {t(listings.length === 1 ? "listing" : "listings")}
              </>
            )}
          </p>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="bg-card !h-10 rounded-lg text-sm font-medium" aria-label={t("Sort by")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="bg-card hidden h-10 items-center rounded-lg border p-1 sm:flex">
            {(
              [
                { value: "comfortable", icon: LayoutGrid, label: "Large cards" },
                { value: "compact", icon: Grid3x3, label: "Small cards" },
              ] as const
            ).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDensity(value)}
                aria-pressed={density === value}
                aria-label={t(label)}
                className={cn(
                  "flex h-full items-center rounded-md px-2.5 transition-colors",
                  density === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>

          {initialListings.some((listing) => listing.priceThb != null) && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 rounded-lg">
                  <Scale /> <span className="hidden xl:inline">{t("Compare prices")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{t("Compare prices")}</DialogTitle>
                  <DialogDescription>{t("Compare asking prices across cards and grading institutes.")}</DialogDescription>
                </DialogHeader>
                {/* Compares across everything listed, not just the filtered
                    results — filters narrow what you browse, not which cards
                    you can compare. */}
                <PriceCompareTable listings={initialListings} />
              </DialogContent>
            </Dialog>
          )}
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
            <FilterBar filters={filters} onChange={setFilters} />
          </div>
          <SheetFooter>
            <Button onClick={() => setFilterSheetOpen(false)} disabled={loading}>
              {loading ? t("Searching…") : t("Show {items}", { items: itemCount })}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className={cn("grid grid-cols-1", sidebarOpen && "lg:grid-cols-[280px_1fr]")}>
        {/* Desktop: filters sit in a sticky sidebar beside the results, so
            they stay reachable while scrolling. */}
        {sidebarOpen && (
          <aside className="hidden border-r lg:block">
            <div className="scrollbar-none sticky top-[72px] max-h-[calc(100vh-72px)] overflow-y-auto py-5 pr-5">
              <FilterBar filters={filters} onChange={setFilters} />
            </div>
          </aside>
        )}

        <div className={cn("flex min-w-0 flex-col gap-6 py-5", sidebarOpen && "lg:pl-5")}>
          <TrendingStrip week={trendingWeek} month={trendingMonth} />

          {/* A storefront-style "pick what you're into" row — the sidebar/sheet
              filters still cover everything in depth. */}
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {CATEGORY_TILES.map(({ category, label, icon: Icon }) => {
              const active = isCategoryTileActive(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => selectCategoryTile(category)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium outline-none transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  <Icon className="size-4" />
                  {t(label)}
                </button>
              );
            })}
            <span className="text-muted-foreground ml-auto hidden self-center text-sm md:hidden sm:inline">
              {loading ? t("Searching…") : itemCount}
            </span>
          </div>

          {loading ? (
            <div className={gridClass}>
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/6.4] w-full rounded-2xl" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-24 text-center">
              <PackageSearch className="size-8" />
              <p className="text-sm">{t("No items match your filters. Try widening your search.")}</p>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  {t("Clear filters")}
                </Button>
              )}
            </div>
          ) : (
            <div className={gridClass}>
              {sortedListings.map((asset) => (
                <ListingCard key={asset.id} asset={asset} compact={density === "compact"} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
