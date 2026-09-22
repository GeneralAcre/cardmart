import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gavel } from "lucide-react";

import { getAuctionById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { ItemGallery } from "@/components/item/item-gallery";
import { BidPanel } from "@/components/auction/bid-panel";
import { BidHistory } from "@/components/auction/bid-history";
import { ClaimWinButton } from "@/components/auction/claim-win-button";
import { CancelAuctionButton } from "@/components/auction/cancel-auction-button";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CATEGORY_LABELS, gradeTierLabel } from "@/lib/labels";
import { formatGrade, formatThb } from "@/lib/format";

const MIN_BID_INCREMENT_THB = 50;

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [auction, user] = await Promise.all([getAuctionById(id), getCurrentUser()]);

  if (!auction) notFound();

  const { asset } = auction;
  const gradeTier = gradeTierLabel(asset.gradingCompany, asset.grade, asset.isBlackLabel);
  const isOwner = asset.ownerId === user.id;
  const hasEnded = auction.status !== "ACTIVE" || auction.endTime <= new Date();
  const topBid = auction.bids[0] ?? null;
  const isWinner = hasEnded && topBid?.bidderId === user.id;
  const minBid = (auction.currentBidThb ?? auction.startPriceThb - MIN_BID_INCREMENT_THB) + MIN_BID_INCREMENT_THB;

  const sellerInitials = (asset.seller.name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/auctions"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Auctions
      </Link>

      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2">
        <ItemGallery
          themeIndex={asset.themeIndex}
          category={asset.category}
          gradingCompany={asset.gradingCompany}
          grade={asset.grade}
          isBlackLabel={asset.isBlackLabel}
          photos={asset.verificationPhotos}
        />

        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Badge variant="outline" className="w-fit rounded-full">
                {CATEGORY_LABELS[asset.category]}
              </Badge>
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {asset.gradingCompany === "RAW"
                  ? "Raw / Ungraded"
                  : `${asset.gradingCompany} ${formatGrade(asset.grade)}${gradeTier ? ` · ${gradeTier}` : ""}`}
              </span>
              <h1 className="text-2xl font-semibold">{asset.name}</h1>
              <p className="text-muted-foreground text-sm">{asset.subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge className="bg-foreground text-background border-0">
                <Gavel className="size-3" />
                {hasEnded ? "Ended" : "Live"}
              </Badge>
              {!hasEnded && (
                <span className="text-sm font-medium tabular-nums">
                  Ends in <CountdownTimer endTime={auction.endTime.toISOString()} />
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x rounded-xl border">
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">
                {auction.currentBidThb != null ? "Current Bid" : "Starting Bid"}
              </span>
              <span className="text-lg leading-none font-bold tabular-nums">
                {formatThb(auction.currentBidThb ?? auction.startPriceThb)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">Bids</span>
              <span className="text-lg leading-none font-bold tabular-nums">{auction.bids.length}</span>
            </div>
          </div>

          {isOwner ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
              <p className="text-muted-foreground text-sm">
                This is your auction — manage it from{" "}
                <Link href="/portfolio" className="text-foreground underline">
                  Portfolio
                </Link>
                .
              </p>
              {auction.status === "ACTIVE" && auction.bids.length === 0 && (
                <CancelAuctionButton auctionId={auction.id} />
              )}
            </div>
          ) : isWinner ? (
            <ClaimWinButton
              auctionId={auction.id}
              amountThb={topBid!.amountThb}
              vaulted={asset.vaulted}
              sellerWalletAddress={asset.owner.walletAddress}
            />
          ) : hasEnded ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {topBid
                ? `This auction ended — sold to the highest bidder for ${formatThb(topBid.amountThb)}.`
                : "This auction ended with no bids."}
            </p>
          ) : (
            <BidPanel auctionId={auction.id} minBid={minBid} />
          )}

          <Link
            href={`/store/${asset.seller.id}`}
            className="bg-card hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-3 transition-colors"
          >
            <Avatar className="size-10 shrink-0">
              {asset.seller.image && <AvatarImage src={asset.seller.image} alt={asset.seller.name ?? ""} />}
              <AvatarFallback className="text-sm font-medium">{sellerInitials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Seller</span>
              <span className="truncate text-sm font-semibold">{asset.seller.name}</span>
            </div>
          </Link>
        </div>
      </div>

      <Separator className="my-10" />

      <div className="max-w-xl">
        <h2 className="mb-4 text-lg font-semibold">Bid History</h2>
        <BidHistory bids={auction.bids} />
      </div>
    </div>
  );
}
