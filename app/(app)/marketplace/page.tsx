import { Plus } from "lucide-react";

import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { ActionButton } from "@/components/ui/action-button";
import { getLeaderboard, getMarketplaceListings } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function MarketplacePage() {
  const user = await getCurrentUser();
  const [listings, movers, t] = await Promise.all([getMarketplaceListings(), getLeaderboard(user.id), getT()]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Market")}</h1>
        <ActionButton href="/marketplace/sell" icon={Plus}>
          {t("Sell a card")}
        </ActionButton>
      </div>
      <MarketplaceExplorer initialListings={listings} pulseRows={movers} />
    </div>
  );
}
