import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { getMarketplaceListings, getTrendingListings } from "@/lib/queries";

export default async function MarketplacePage() {
  const [listings, trending] = await Promise.all([getMarketplaceListings(), getTrendingListings()]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <MarketplaceExplorer initialListings={listings} trending={trending} />
    </div>
  );
}
