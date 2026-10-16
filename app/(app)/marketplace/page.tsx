import { Plus } from "lucide-react";

import { MarketIndexes } from "@/components/marketplace/market-indexes";
import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { ActionButton } from "@/components/ui/action-button";
import { getLeaderboard, getMarketplaceListings } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getMarketIndexes } from "@/lib/stats";

export default async function MarketplacePage() {
  const user = await getCurrentUser();
  const [listings, movers, indexes, t] = await Promise.all([
    getMarketplaceListings(),
    getLeaderboard(user.id),
    getMarketIndexes(),
    getT(),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("Market")}</h1>
        <ActionButton href="/marketplace/sell" icon={Plus}>
          {t("Sell a card")}
        </ActionButton>
      </div>
      {indexes.some((i) => i.points.length > 0) && (
        <div className="mb-6">
          <MarketIndexes indexes={indexes} />
        </div>
      )}
      <MarketplaceExplorer initialListings={listings} pulseRows={movers} />
    </div>
  );
}
