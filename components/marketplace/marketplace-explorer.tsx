"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Grid3x3, LayoutGrid, PackageSearch, Scale, Search, SlidersHorizontal, X } from "lucide-react";

import { FilterBar } from "@/components/marketplace/filter-bar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MAX_COMPARE, PriceCompareTable, compareCardKey } from "@/components/marketplace/price-compare-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { EMPTY_FILTERS, type AssetSummary, type MarketplaceFilterState } from "@/lib/types";

type SortKey = "recent" | "price-asc" | "price-desc";
/** Cards drawn per page of the grid; more load as you scroll. */
const PAGE_SIZE = 40;

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
  filters.rarities.forEach((r) => sp.append("rarity", r));
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
    filters.rarities.length +
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
  initialFilters = EMPTY_FILTERS,
}: {
  initialListings: AssetSummary[];
  /** Starting filters, e.g. from the hero search (?q=…&game=…). */
  initialFilters?: MarketplaceFilterState;
}) {
  const [filters, setFilters] = useState<MarketplaceFilterState>(initialFilters);
  const [listings, setListings] = useState<AssetSummary[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");
  const [density, setDensity] = useState<Density>("comfortable");
  // Cards picked for comparison, from the grid or inside the dialog.
  const [compareCards, setCompareCards] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const isFirstRender = useRef(true);
  // Opened with filters already set (the hero search): fetch right away instead of showing the unfiltered list.
  const startedFiltered = useRef(initialFilters !== EMPTY_FILTERS);
  const activeFilterCount = countActiveFilters(filters);
  const t = useT();
  const itemCount = t(listings.length === 1 ? "{count} item" : "{count} items", { count: listings.length });
  const sortedListings = useMemo(() => sortListings(listings, sort), [listings, sort]);

  // Draw the grid a page at a time: with thousands of listings, rendering
  // every card at once makes the page slow. The limit belongs to one result
  // set, so a new search or sort starts back at the first page by itself.
  const [paging, setPaging] = useState({ source: sortedListings, limit: PAGE_SIZE });
  const limit = paging.source === sortedListings ? paging.limit : PAGE_SIZE;
  const visibleListings = sortedListings.slice(0, limit);
  const hasMore = limit < sortedListings.length;
  const showMore = () => setPaging({ source: sortedListings, limit: limit + PAGE_SIZE });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    // Load the next page a little before the bottom comes into view.
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && showMore(), { rootMargin: "600px" });
    observer.observe(el);
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!startedFiltered.current) return;
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
      {/* Toolbar: filters toggle, result count, sort, density. */}
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

        {/* Search: types straight into the same filter the sidebar uses, so
            results update as you type. Full width on its own row on phones. */}
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="bg-card focus-within:border-foreground/40 order-last flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border px-3 transition-colors sm:order-none sm:w-auto sm:flex-1"
        >
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder={t("Search cards")}
            aria-label={t("Search cards")}
            className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, q: "" })}
              aria-label={t("Clear search")}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label={t("Search")}
            disabled={!filters.q}
            className="text-muted-foreground enabled:hover:text-foreground shrink-0 transition-colors disabled:opacity-40"
          >
            <ArrowRight className="size-4" />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 rounded-lg">
                  <Scale /> <span className="hidden xl:inline">{t("Compare prices")}</span>
                  {compareCards.length > 0 && (
                    <span className="bg-success text-background rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums">
                      {compareCards.length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{t("Compare prices")}</DialogTitle>
                  <DialogDescription>{t("Compare asking prices across cards and grading institutes.")}</DialogDescription>
                </DialogHeader>
                {/* Compares across everything listed, not just the filtered
                    results — filters narrow what you browse, not which cards
                    you can compare. */}
                <PriceCompareTable listings={initialListings} selected={compareCards} onSelectedChange={setCompareCards} />
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
            <>
            <div className={gridClass}>
              {visibleListings.map((asset) => {
                const key = compareCardKey(asset);
                const selected = compareCards.includes(key);
                return (
                  <ListingCard
                    key={asset.id}
                    asset={asset}
                    compact={density === "compact"}
                    compare={
                      asset.priceThb == null
                        ? undefined
                        : {
                            selected,
                            disabled: !selected && compareCards.length >= MAX_COMPARE,
                            onToggle: () =>
                              setCompareCards((prev) => (selected ? prev.filter((k) => k !== key) : [...prev, key])),
                          }
                    }
                  />
                );
              })}
            </div>
            {hasMore && (
              <div ref={sentinel} className="flex flex-col items-center gap-2 pt-8">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t("Showing {shown} of {total}", { shown: visibleListings.length, total: sortedListings.length })}
                </span>
                <Button variant="outline" size="sm" onClick={showMore}>
                  {t("Show more")}
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      </div>
      {compareCards.length > 0 && !compareOpen && (
        <div className="bg-card fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2 rounded-full border p-1.5 pl-4 shadow-lg md:bottom-6">
          <Scale className="text-muted-foreground size-4 shrink-0" />
          <span className="flex-1 text-sm font-medium">
            {t("{count} of {max} cards picked", { count: compareCards.length, max: MAX_COMPARE })}
          </span>
          <Button size="sm" className="rounded-full" onClick={() => setCompareOpen(true)}>
            {t("Compare")}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 rounded-full"
            onClick={() => setCompareCards([])}
            aria-label={t("Clear comparison")}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}
