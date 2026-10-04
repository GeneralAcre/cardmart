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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="eyebrow text-foreground text-sm">{t("Market")}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {t("Certified cards, paid through escrow and checked at our warehouse before the seller is paid.")}
          </p>
        </div>
        {/* ml-auto keeps it on the right when it wraps below the intro on phones. */}
        <ActionButton href="/marketplace/sell" icon={Plus} className="ml-auto">
          {t("Sell a card")}
        </ActionButton>
      </div>
      <MarketplaceExplorer initialListings={listings} pulseRows={movers} />
    </div>
  );
}
