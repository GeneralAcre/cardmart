import Link from "next/link";
import { Plus } from "lucide-react";
import type { CardGame } from "@prisma/client";

import { MarketHero } from "@/components/marketplace/market-hero";
import { MarketIndexes } from "@/components/marketplace/market-indexes";
import { MarketPulse } from "@/components/marketplace/market-pulse";
import { MarketplaceExplorer } from "@/components/marketplace/marketplace-explorer";
import { ActionButton } from "@/components/ui/action-button";
import { getLeaderboard, getMarketplaceListings } from "@/lib/queries";
import { getOptionalUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getMarketIndexes } from "@/lib/stats";
import { CARD_GAMES } from "@/lib/labels";
import { EMPTY_FILTERS } from "@/lib/types";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string; game?: string }> }) {
  const [{ q, game }, user] = await Promise.all([searchParams, getOptionalUser()]);
  const [listings, movers, indexes, t] = await Promise.all([
    getMarketplaceListings(),
    getLeaderboard(user?.id ?? ""),
    getMarketIndexes(),
    getT(),
  ]);

  // The hero's search lands here as ?q=…&game=…, applied as starting filters.
  const startGame = CARD_GAMES.find((g): g is CardGame => g === game);
  const initialFilters = { ...EMPTY_FILTERS, q: q?.trim() ?? "", games: startGame ? [startGame] : [] };

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <MarketHero />
      <div id="listings" className="mb-5 flex scroll-mt-20 items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("Market")}</h1>
        {user && (
          <>
            <ActionButton href="/marketplace/sell" icon={Plus} className="hidden md:inline-flex">
              {t("Sell a card")}
            </ActionButton>
            {/* Phones: a round + pinned bottom right, just above the bottom menu, like a floating add button. */}
            <Link
              href="/marketplace/sell"
              aria-label={t("Sell a card")}
              title={t("Sell a card")}
              className="bg-primary text-primary-foreground fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 md:hidden"
            >
              <Plus className="size-7" />
            </Link>
          </>
        )}
      </div>
      {indexes.some((i) => i.points.length > 0) && (
        <div className="mb-6">
          <MarketIndexes indexes={indexes} />
        </div>
      )}
      {/* Trending movers and the heatmap sit right under the indexes, above the filters and listings. */}
      <div className="mb-6">
        <MarketPulse rows={movers} />
      </div>
      <MarketplaceExplorer
        key={`${initialFilters.q}|${initialFilters.games.join(",")}`}
        initialListings={listings}
        initialFilters={initialFilters}
      />
    </div>
  );
}
