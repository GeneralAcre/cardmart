"use client";

import { useEffect, useRef, useState } from "react";
import { PackageSearch } from "lucide-react";

import { FilterBar } from "@/components/marketplace/filter-bar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_FILTERS, type AssetSummary, type MarketplaceFilterState } from "@/lib/types";

function buildQuery(filters: MarketplaceFilterState) {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  filters.gradingCompanies.forEach((c) => sp.append("gradingCompany", c));
  filters.grades.forEach((g) => sp.append("grade", String(g)));
  if (filters.priceMin != null) sp.set("priceMin", String(filters.priceMin));
  if (filters.priceMax != null) sp.set("priceMax", String(filters.priceMax));
  if (filters.vaultedStatus !== "ALL") sp.set("vaultedStatus", filters.vaultedStatus);
  return sp.toString();
}

export function MarketplaceExplorer({ initialListings }: { initialListings: AssetSummary[] }) {
  const [filters, setFilters] = useState<MarketplaceFilterState>(EMPTY_FILTERS);
  const [listings, setListings] = useState<AssetSummary[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const isFirstRender = useRef(true);

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
      <FilterBar filters={filters} onChange={setFilters} />

      <div>
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
