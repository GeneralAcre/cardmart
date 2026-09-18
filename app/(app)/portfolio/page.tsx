import Link from "next/link";
import { Bookmark, PackageOpen, Sparkles } from "lucide-react";

import { getGradingSubmissions, getPortfolioPriceHistory, getVaultAssets, getWatchlist } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getDevnetSolBalance } from "@/lib/solana";
import { ListingCard } from "@/components/marketplace/listing-card";
import { PortfolioItemCard } from "@/components/portfolio/portfolio-item-card";
import { ProfileHeader } from "@/components/portfolio/profile-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_LABELS, GRADING_SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatThb } from "@/lib/format";

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  const walletAddress = user.walletAddress ?? user.walletMock;
  const [assets, submissions, solBalance, portfolioValueHistory, watchlist] = await Promise.all([
    getVaultAssets(user.id),
    getGradingSubmissions(user.id),
    getDevnetSolBalance(user.walletAddress), // real balance only for real (Privy) wallets, not the mock demo ones
    getPortfolioPriceHistory(user.id, "7d"), // default range matches PortfolioValueChart's own initial state
    getWatchlist(user.id),
  ]);

  const inHand = assets.filter((a) => !a.vaulted);
  const inVault = assets.filter((a) => a.vaulted);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <p className="text-muted-foreground text-sm">
          Digital certificates currently in your profile, whether the
          physical item is in your hands or held in our warehouse vault.
        </p>
      </div>

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
          <TabsTrigger value="grading">
            <span className="sm:hidden">Grading ({submissions.length})</span>
            <span className="hidden sm:inline">Grading Submissions ({submissions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist ({watchlist.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-6">
          <PortfolioGrid assets={assets} />
        </TabsContent>
        <TabsContent value="hand" className="pt-6">
          <PortfolioGrid assets={inHand} />
        </TabsContent>
        <TabsContent value="vault" className="pt-6">
          <PortfolioGrid assets={inVault} />
        </TabsContent>
        <TabsContent value="grading" className="pt-6">
          <GradingSubmissionList submissions={submissions} />
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
      </Tabs>
    </div>
  );
}

function PortfolioGrid({ assets }: { assets: Awaited<ReturnType<typeof getVaultAssets>> }) {
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
        <PortfolioItemCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}

function GradingSubmissionList({
  submissions,
}: {
  submissions: Awaited<ReturnType<typeof getGradingSubmissions>>;
}) {
  if (submissions.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Sparkles className="size-8" />
        <p className="text-sm">No Full-Service submissions yet.</p>
        <Link href="/verify" className="text-foreground text-sm underline">
          Submit a raw item for grading
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {submissions.map((s) => (
        <div key={s.id} className="bg-card flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{s.itemName}</span>
              <Badge variant="outline">{CATEGORY_LABELS[s.category]}</Badge>
            </div>
            <p className="text-muted-foreground text-xs">{s.itemSubtitle}</p>
            <p className="text-muted-foreground text-xs">
              Submitted {formatDate(s.createdAt)} &middot; Package fee {formatThb(s.packagePriceThb)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={s.status === "REJECTED" ? "destructive" : "secondary"}>
              {GRADING_SUBMISSION_STATUS_LABELS[s.status]}
            </Badge>
            {s.status === "GRADED" && s.resultAssetId && (
              <Link href={`/item/${s.resultAssetId}`} className="text-xs underline">
                View listing
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
