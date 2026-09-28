import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gavel } from "lucide-react";

import { getAuctionById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { ItemGallery } from "@/components/item/item-gallery";
import { BidPanel } from "@/components/auction/bid-panel";
import { BidHistory } from "@/components/auction/bid-history";
import { ClaimWinButton } from "@/components/auction/claim-win-button";
import { AutoSettle } from "@/components/auction/auto-settle";
import { CancelAuctionButton } from "@/components/auction/cancel-auction-button";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CARD_GAME_LABELS, gradeTierLabel } from "@/lib/labels";
import { formatGrade, formatThb } from "@/lib/format";

const MIN_BID_INCREMENT_THB = 50;

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [auction, user, t] = await Promise.all([getAuctionById(id), getCurrentUser(), getT()]);

  if (!auction) notFound();

  const { asset } = auction;
  const gradeTier = gradeTierLabel(asset.gradingCompany, asset.grade, asset.isBlackLabel);
  const isOwner = asset.ownerId === user.id;
  const hasNotStarted = auction.startTime > new Date();
  const hasEnded = auction.status !== "ACTIVE" || auction.endTime <= new Date();
  const topBid = auction.bids[0] ?? null;
  // Bidding closed but settleAuction hasn't finished yet (see AutoSettle).
  const awaitingSettlement = auction.status === "ACTIVE" && hasEnded && topBid != null;
  const isWinner = awaitingSettlement && topBid.bidderId === user.id;
  const myLockedBidThb = !hasEnded && topBid?.bidderId === user.id && topBid.lockStatus === "HELD" ? topBid.amountThb : null;
  const minBid = (auction.currentBidThb ?? auction.startPriceThb - MIN_BID_INCREMENT_THB) + MIN_BID_INCREMENT_THB;

  const sellerInitials = (asset.seller.name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      {awaitingSettlement && <AutoSettle auctionIds={[auction.id]} />}
      <Link
        href="/auctions"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("Back to Auctions")}
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
                {t(CARD_GAME_LABELS[asset.game])}
              </Badge>
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {asset.gradingCompany === "RAW"
                  ? t("Raw / Ungraded")
                  : `${asset.gradingCompany} ${formatGrade(asset.grade)}${gradeTier ? ` · ${gradeTier}` : ""}`}
              </span>
              <h1 className="text-2xl font-semibold">{asset.name}</h1>
              <p className="text-muted-foreground text-sm">{asset.subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge className="bg-foreground text-background border-0">
                <Gavel className="size-3" />
                {hasEnded ? t("Ended") : hasNotStarted ? t("Scheduled") : t("Live")}
              </Badge>
              {hasNotStarted ? (
                <span className="text-sm font-medium tabular-nums">
                  {t("Starts in")} <CountdownTimer endTime={auction.startTime.toISOString()} />
                </span>
              ) : !hasEnded && (
                <span className="text-sm font-medium tabular-nums">
                  {t("Ends in")} <CountdownTimer endTime={auction.endTime.toISOString()} />
                </span>
              )}
            </div>
          </div>

          <div className="detail-panel grid grid-cols-2 divide-x rounded-xl border">
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">
                {auction.currentBidThb != null ? t("Current Bid") : t("Starting Bid")}
              </span>
              <span className="text-lg leading-none font-bold tabular-nums">
                {formatThb(auction.currentBidThb ?? auction.startPriceThb)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">{t("Bids")}</span>
              <span className="text-lg leading-none font-bold tabular-nums">{auction.bids.length}</span>
            </div>
          </div>

          {isOwner ? (
            <div className="detail-panel flex flex-col gap-3 rounded-lg border border-dashed p-4">
              <p className="text-muted-foreground text-sm">
                {t("This is your auction — manage it from")}{" "}
                <Link href="/portfolio" className="text-foreground underline">
                  {t("Portfolio")}
                </Link>
                .
              </p>
              {auction.status === "ACTIVE" && auction.bids.length === 0 && (
                <CancelAuctionButton auctionId={auction.id} />
              )}
            </div>
          ) : hasNotStarted ? (
            <p className="detail-panel text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {t("Bidding opens")} <span className="font-medium text-foreground">{auction.startTime.toLocaleString()}</span>.
            </p>
          ) : isWinner ? (
            <ClaimWinButton
              auctionId={auction.id}
              amountThb={topBid.amountThb}
              vaulted={asset.vaulted}
              locked={topBid.lockStatus === "HELD"}
              claimDeadline={auction.claimDeadline?.toISOString() ?? null}
              sellerWalletAddress={asset.owner.walletAddress}
            />
          ) : hasEnded ? (
            <p className="detail-panel text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {auction.status === "ENDED_UNCLAIMED"
                ? t("This auction ended, but the winner didn't claim it in time. The card went back to the seller.")
                : awaitingSettlement
                  ? t("Bidding closed at {amount} — waiting on the winner's delivery choice.", { amount: formatThb(topBid.amountThb) })
                  : topBid
                    ? t("This auction ended — sold to the highest bidder for {amount}.", { amount: formatThb(topBid.amountThb) })
                    : t("This auction ended with no bids.")}
            </p>
          ) : (
            <BidPanel
              auctionId={auction.id}
              minBid={minBid}
              sellerWalletAddress={asset.owner.walletAddress}
              myLockedBidThb={myLockedBidThb}
            />
          )}

          <Link
            href={`/store/${asset.seller.id}`}
            className="detail-panel hover:bg-highlight/15 flex items-center gap-3 rounded-xl border p-3 transition-colors"
          >
            <Avatar className="size-10 shrink-0">
              {asset.seller.image && <AvatarImage src={asset.seller.image} alt={asset.seller.name ?? ""} />}
              <AvatarFallback className="text-sm font-medium">{sellerInitials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">{t("Seller")}</span>
              <span className="truncate text-sm font-semibold">{asset.seller.name}</span>
            </div>
          </Link>
        </div>
      </div>

      <Separator className="my-10" />

      <div className="max-w-xl">
        <h2 className="mb-4 text-lg font-semibold">{t("Bid History")}</h2>
        <BidHistory bids={auction.bids} />
      </div>
    </div>
  );
}
