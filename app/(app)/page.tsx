import { Hero } from "@/components/marketplace/hero";
import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { getMarketplaceListings } from "@/lib/queries";

export default async function Home() {
  const listings = await getMarketplaceListings();

  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <h2 className="mb-6 text-xl font-semibold">Marketplace</h2>
        <MarketplaceExplorer initialListings={listings} />
      </div>
    </div>
  );
}
