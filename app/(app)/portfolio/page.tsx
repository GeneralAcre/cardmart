import Link from "next/link";
import { Bookmark, PackageOpen } from "lucide-react";

import {
  getOffersMade,
  getOffersReceived,
  getPortfolioPriceHistory,
  getVaultAssets,
  getWatchlist,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getDevnetSolBalance } from "@/lib/solana";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { ListingCard } from "@/components/marketplace/listing-card";
import { PortfolioItemCard } from "@/components/portfolio/portfolio-item-card";
import { OffersPanel } from "@/components/portfolio/offers-panel";
import { ProfileHeader } from "@/components/portfolio/profile-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  const walletAddress = user.walletAddress ?? user.walletMock;
  const [
    assets,
    solBalance,
    portfolioValueHistory,
    watchlist,
    escrowAuthorityAddress,
    offersReceived,
    offersMade,
  ] = await Promise.all([
    getVaultAssets(user.id),
    getDevnetSolBalance(user.walletAddress), // real balance only for real (Privy) wallets, not the mock demo ones
    getPortfolioPriceHistory(user.id, "7d"), // default range matches PortfolioValueChart's own initial state
    getWatchlist(user.id),
    getEscrowAuthorityAddress(),
    getOffersReceived(user.id),
    getOffersMade(user.id),
  ]);

  const inHand = assets.filter((a) => !a.vaulted);
  const inVault = assets.filter((a) => a.vaulted);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <ProfileHeader
          name={user.name ?? user.handle ?? "Collector"}
          handle={user.handle}
          image={user.image}
          walletAddress={walletAddress}
          createdAt={user.createdAt}
          solBalance={solBalance}
          portfolioValueHistory={portfolioValueHistory.map((p) => ({
            totalThb: p.totalThb,
            createdAt: p.createdAt.toISOString(),
          }))}
          shippingAddress={user.shippingAddress}
          phone={user.phone}
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({assets.length})</TabsTrigger>
          <TabsTrigger value="hand">
            <span className="sm:hidden">In Hand ({inHand.length})</span>
            <span className="hidden sm:inline">Physical in My Hands ({inHand.length})</span>
          </TabsTrigger>
          <TabsTrigger value="vault">
            <span className="sm:hidden">In Vault ({inVault.length})</span>
            <span className="hidden sm:inline">Physical in Warehouse Vault ({inVault.length})</span>
          </TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist ({watchlist.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offersReceived.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-6">
          <PortfolioGrid assets={assets} escrowAuthorityAddress={escrowAuthorityAddress} />
        </TabsContent>
        <TabsContent value="hand" className="pt-6">
          <PortfolioGrid assets={inHand} escrowAuthorityAddress={escrowAuthorityAddress} />
        </TabsContent>
        <TabsContent value="vault" className="pt-6">
          <PortfolioGrid assets={inVault} escrowAuthorityAddress={escrowAuthorityAddress} />
        </TabsContent>
        <TabsContent value="watchlist" className="pt-6">
          {watchlist.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
              <Bookmark className="size-8" />
              <p className="text-sm">Nothing on your watchlist yet.</p>
              <Link href="/marketplace" className="text-foreground text-sm underline">
                Browse the marketplace
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {watchlist.map((asset) => (
                <ListingCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="offers" className="pt-6">
          <OffersPanel received={offersReceived} made={offersMade} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PortfolioGrid({
  assets,
  escrowAuthorityAddress,
}: {
  assets: Awaited<ReturnType<typeof getVaultAssets>>;
  escrowAuthorityAddress: string | null;
}) {
  if (assets.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <PackageOpen className="size-8" />
        <p className="text-sm">Nothing here yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => (
        <PortfolioItemCard key={asset.id} asset={asset} escrowAuthorityAddress={escrowAuthorityAddress} />
      ))}
    </div>
  );
}
