import Link from "next/link";
import { Plus } from "lucide-react";

import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { Button } from "@/components/ui/button";
import { getMarketplaceListings, getTrendingListings } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";

export default async function MarketplacePage() {
  const [listings, trendingWeek, trendingMonth, t] = await Promise.all([
    getMarketplaceListings(),
    getTrendingListings(8, 7),
    getTrendingListings(8, 30),
    getT(),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("Marketplace")}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {t("Certified cards, paid through escrow and checked at our warehouse before the seller is paid.")}
          </p>
        </div>
        <Button asChild>
          <Link href="/marketplace/sell">
            <Plus /> {t("Sell a card")}
          </Link>
        </Button>
      </div>
      <MarketplaceExplorer initialListings={listings} trendingWeek={trendingWeek} trendingMonth={trendingMonth} />
    </div>
  );
}
