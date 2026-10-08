import { Gavel } from "lucide-react";

import { getActiveAuctions, getVaultAssets } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { AuctionList } from "@/components/auction/auction-list";
import { CreateAuctionButton } from "@/components/auction/create-auction-button";
import { AutoSettle } from "@/components/auction/auto-settle";

export default async function AuctionsPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const [auctions, myAssets] = await Promise.all([getActiveAuctions(), getVaultAssets(user.id)]);
  const eligibleAssets = myAssets
    .filter((a) => a.marketStatus !== "IN_AUCTION" && a.marketStatus !== "IN_ESCROW")
    .map((a) => ({ id: a.id, name: a.name, subtitle: a.subtitle, priceThb: a.priceThb }));
  const now = new Date();
  const dueForSettlement = auctions.filter((a) => a.endTime <= now).map((a) => a.id);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <AutoSettle auctionIds={dueForSettlement} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("Auctions")}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {t("Time-limited bidding on real, verified certificates — a separate sale channel from the fixed-price marketplace.")}
          </p>
        </div>
        <CreateAuctionButton eligibleAssets={eligibleAssets} />
      </div>

      {auctions.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
          <Gavel className="size-8" />
          <p className="text-sm">{t("No live auctions right now.")}</p>
        </div>
      ) : (
        <AuctionList auctions={auctions} />
      )}
    </div>
  );
}
