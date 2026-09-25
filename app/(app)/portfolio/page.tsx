import Link from "next/link";
import { Bookmark, Flame, PackageOpen } from "lucide-react";

import {
  getMyRedeemedAssets,
  getMyTradeOffers,
  getMyWantedCards,
  getOffersMade,
  getOffersReceived,
  getPortfolioPriceHistory,
  getSellerRating,
  getVaultAssets,
  getWatchlist,
} from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { isKycPhotoStorageConfigured } from "@/lib/kyc-storage";
import { getCurrentUser } from "@/lib/session";
import { getDevnetSolBalance } from "@/lib/solana";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { ListingCard } from "@/components/marketplace/listing-card";
import { PortfolioItemCard } from "@/components/portfolio/portfolio-item-card";
import { OffersPanel } from "@/components/portfolio/offers-panel";
import { ProfileHeader } from "@/components/portfolio/profile-header";
import { IdentityCard } from "@/components/portfolio/identity-card";
import { WantedCardsPanel } from "@/components/wanted/wanted-cards-panel";
import { TradesPanel } from "@/components/trade/trades-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatGrade } from "@/lib/format";

const TABS = ["all", "hand", "vault", "watchlist", "offers", "trades", "alerts"] as const;

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const defaultTab = TABS.find((t) => t === tab) ?? "all";
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
    trades,
    wantedCards,
    redeemed,
    rating,
    completedSales,
  ] = await Promise.all([
    getVaultAssets(user.id),
    getDevnetSolBalance(user.walletAddress), // real balance only for real (Privy) wallets, not the mock demo ones
    getPortfolioPriceHistory(user.id, "7d"), // default range matches PortfolioValueChart's own initial state
    getWatchlist(user.id),
    getEscrowAuthorityAddress(),
    getOffersReceived(user.id),
    getOffersMade(user.id),
    getMyTradeOffers(user.id),
    getMyWantedCards(user.id),
    getMyRedeemedAssets(user.id),
    getSellerRating(user.id),
    prisma.escrowTransaction.count({ where: { sellerId: user.id, status: "RELEASED" } }),
  ]);
  const pendingTradesForMe = trades.received.filter((t) => t.status === "PENDING").length;

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

      <div className="mb-8">
        <IdentityCard
          status={user.kycStatus}
          rejectReason={user.kycRejectReason}
          rating={rating.average}
          reviewCount={rating.count}
          completedSales={completedSales}
          photoStorageReady={isKycPhotoStorageConfigured()}
        />
      </div>

      <Tabs defaultValue={defaultTab}>
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
          <TabsTrigger value="trades">Trades ({pendingTradesForMe})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({wantedCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-6">
          <PortfolioGrid assets={assets} escrowAuthorityAddress={escrowAuthorityAddress} />
        </TabsContent>
        <TabsContent value="hand" className="pt-6">
          <PortfolioGrid assets={inHand} escrowAuthorityAddress={escrowAuthorityAddress} />
        </TabsContent>
        <TabsContent value="vault" className="pt-6">
          <PortfolioGrid assets={inVault} escrowAuthorityAddress={escrowAuthorityAddress} />
          {redeemed.length > 0 && (
            <div className="mt-10">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Flame className="size-4" /> Redeemed ({redeemed.length})
              </h3>
              <div className="flex flex-col gap-2">
                {redeemed.map((a) => (
                  <Link
                    key={a.id}
                    href={`/item/${a.id}`}
                    className="bg-card hover:bg-accent flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm transition-colors"
                  >
                    <span className="font-medium">
                      {a.name}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {a.gradingCompany === "RAW" ? "Raw" : `${a.gradingCompany} ${formatGrade(a.grade)}`}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Shipped to you {a.redeemedAt ? formatDate(a.redeemedAt) : ""} · digital twin burned
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
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
        <TabsContent value="trades" className="pt-6">
          <TradesPanel received={trades.received} sent={trades.sent} escrowAuthorityAddress={escrowAuthorityAddress} />
        </TabsContent>
        <TabsContent value="alerts" className="pt-6">
          <WantedCardsPanel cards={wantedCards} />
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
