import { Gavel } from "lucide-react";

import { getActiveAuctions, getVaultAssets } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { AuctionCard } from "@/components/auction/auction-card";
import { CreateAuctionButton } from "@/components/auction/create-auction-button";

export default async function AuctionsPage() {
  const user = await getCurrentUser();
  const [auctions, myAssets] = await Promise.all([getActiveAuctions(), getVaultAssets(user.id)]);
  const eligibleAssets = myAssets
    .filter((a) => a.marketStatus !== "IN_AUCTION" && a.marketStatus !== "IN_ESCROW")
    .map((a) => ({ id: a.id, name: a.name, subtitle: a.subtitle, priceThb: a.priceThb }));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Auctions</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Time-limited bidding on real, verified certificates — a separate sale channel from the
            fixed-price marketplace.
          </p>
        </div>
        <CreateAuctionButton eligibleAssets={eligibleAssets} />
      </div>

      {auctions.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
          <Gavel className="size-8" />
          <p className="text-sm">No live auctions right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
