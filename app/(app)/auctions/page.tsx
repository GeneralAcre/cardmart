import { Gavel } from "lucide-react";

import { getActiveAuctions, getVaultAssets } from "@/lib/queries";
import { getOptionalUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { AuctionList } from "@/components/auction/auction-list";
import { CreateAuctionButton } from "@/components/auction/create-auction-button";
import { AutoSettle } from "@/components/auction/auto-settle";
import { PageTour } from "@/components/tour/page-tour";

export default async function AuctionsPage() {
  const [user, t] = await Promise.all([getOptionalUser(), getT()]);
  // A guest sees the live auctions; they just have no cards of their own to
  // put up, so the "create auction" picker comes back empty.
  const [auctions, myAssets] = await Promise.all([getActiveAuctions(), user ? getVaultAssets(user.id) : Promise.resolve([])]);
  const eligibleAssets = myAssets
    .filter((a) => a.marketStatus !== "IN_AUCTION" && a.marketStatus !== "IN_ESCROW")
    .map((a) => ({ id: a.id, name: a.name, subtitle: a.subtitle, priceThb: a.priceThb }));
  const now = new Date();
  const dueForSettlement = auctions.filter((a) => a.endTime <= now).map((a) => a.id);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <AutoSettle auctionIds={dueForSettlement} />
      <PageTour id="auctions" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("Auctions")}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {t("Time-limited bidding on real, verified certificates — a separate sale channel from the fixed-price marketplace.")}
          </p>
        </div>
        <div
          data-tour="create-auction"
          data-tour-skip={eligibleAssets.length === 0 ? "You don't have a card to auction yet, so you can skip this for now." : undefined}
        >
          <CreateAuctionButton eligibleAssets={eligibleAssets} />
        </div>
      </div>

      {auctions.length === 0 ? (
        <div
          data-tour="auction-list"
          className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center"
        >
          <Gavel className="size-8" />
          <p className="text-sm">{t("No live auctions right now.")}</p>
        </div>
      ) : (
        <div data-tour="auction-list">
          <AuctionList auctions={auctions} />
        </div>
      )}
    </div>
  );
}
