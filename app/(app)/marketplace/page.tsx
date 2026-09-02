import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { getMarketplaceListings } from "@/lib/queries";

export default async function MarketplacePage() {
  const listings = await getMarketplaceListings();

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <p className="text-muted-foreground text-sm">
          Browse certified collectibles for sale — filter by grading company, grade, price, and vault status.
        </p>
      </div>
      <MarketplaceExplorer initialListings={listings} />
    </div>
  );
}
