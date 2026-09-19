"use client";

import { useEffect, useRef, useState } from "react";
import { PackageSearch, SlidersHorizontal } from "lucide-react";

import { FilterBar } from "@/components/marketplace/filter-bar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EMPTY_FILTERS, type AssetSummary, type MarketplaceFilterState } from "@/lib/types";

function buildQuery(filters: MarketplaceFilterState) {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  filters.categories.forEach((c) => sp.append("category", c));
  filters.gradingCompanies.forEach((c) => sp.append("gradingCompany", c));
  filters.grades.forEach((g) => sp.append("grade", String(g)));
  if (filters.priceMin != null) sp.set("priceMin", String(filters.priceMin));
  if (filters.priceMax != null) sp.set("priceMax", String(filters.priceMax));
  if (filters.vaultedStatus !== "ALL") sp.set("vaultedStatus", filters.vaultedStatus);
  return sp.toString();
}

function countActiveFilters(filters: MarketplaceFilterState): number {
  return (
    (filters.q ? 1 : 0) +
    filters.categories.length +
    filters.gradingCompanies.length +
    filters.grades.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.vaultedStatus !== "ALL" ? 1 : 0)
  );
}

export function MarketplaceExplorer({ initialListings }: { initialListings: AssetSummary[] }) {
  const [filters, setFilters] = useState<MarketplaceFilterState>(EMPTY_FILTERS);
  const [listings, setListings] = useState<AssetSummary[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const isFirstRender = useRef(true);
  const activeFilterCount = countActiveFilters(filters);

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* Desktop: filters sit in a sticky sidebar so they stay reachable
          while scrolling a long result list. */}
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
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <FilterBar filters={filters} onChange={setFilters} className="border-0 p-0 shadow-none" />
          </div>
          <SheetFooter>
            <Button onClick={() => setFilterSheetOpen(false)} disabled={loading}>
              {loading ? "Searching…" : `Show ${listings.length} item${listings.length === 1 ? "" : "s"}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {loading ? "Searching…" : `${listings.length} item${listings.length === 1 ? "" : "s"}`}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setFilterSheetOpen(true)}
          >
            <SlidersHorizontal /> Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-1 size-4 rounded-full p-0 text-[10px]">{activeFilterCount}</Badge>
            )}
          </Button>
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
            <p className="text-sm">No items match your filters. Try widening your search.</p>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
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
    </div>
  );
}
