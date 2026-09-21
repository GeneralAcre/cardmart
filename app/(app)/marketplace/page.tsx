import { Gem } from "lucide-react";

import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { TrendingStrip } from "@/components/marketplace/trending-strip";
import { getMarketplaceListings, getTrendingListings } from "@/lib/queries";

export default async function MarketplacePage() {
  const [listings, trending] = await Promise.all([getMarketplaceListings(), getTrendingListings()]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-3">
        <span className="bg-foreground text-background inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <Gem className="size-3.5" />
          {listings.length} certified item{listings.length === 1 ? "" : "s"} live right now
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Marketplace</h1>
        <p className="text-muted-foreground max-w-xl text-sm text-balance">
          Browse certified collectibles for sale — filter by grading company, grade, price, and vault status.
        </p>
      </div>
      <TrendingStrip listings={trending} />
      <MarketplaceExplorer initialListings={listings} />
    </div>
  );
}
