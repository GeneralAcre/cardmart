import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAcceptedOfferForViewer,
  getActiveAuctionForAsset,
  getAssetById,
  getAssetInsightData,
  getCardMarketStats,
  getMySwappableAssets,
  getPriceHistory,
  getSellerRating,
  getSimilarAssets,
  isAssetWatched,
} from "@/lib/queries";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { buildPriceInsights } from "@/lib/insights";
import { PlatformPriceTable } from "@/components/item/platform-price-table";
import { PriceInsights } from "@/components/item/price-insights";
import { WantedCardButton } from "@/components/wanted/wanted-card-form";
import { ProposeSwapButton } from "@/components/trade/propose-swap-button";
import { VerifiedBadge } from "@/components/store/verified-badge";
import { getCurrentUser } from "@/lib/session";
import { ItemGallery } from "@/components/item/item-gallery";
import { PriceHistoryChart } from "@/components/item/price-history-chart";
import { ProvenanceTimeline } from "@/components/item/provenance-timeline";
import { BuyPanel } from "@/components/item/buy-panel";
import { WatchButton } from "@/components/item/watch-button";
import { MakeOfferButton } from "@/components/item/make-offer-button";
import { MessageSellerButton } from "@/components/messages/message-seller-button";
import { AcceptedOfferBanner } from "@/components/item/accepted-offer-banner";
import { SimilarListings } from "@/components/item/similar-listings";
import { LeaveReviewForm } from "@/components/store/leave-review-form";
import { RatingStars } from "@/components/store/rating-stars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ChevronDown, ExternalLink, Flame, Gavel, History } from "lucide-react";

import { formatDate, formatGrade, formatThb } from "@/lib/format";
import {
  CARD_GAME_LABELS,
  MARKET_STATUS_BADGE_CLASS,
  MARKET_STATUS_LABELS,
  VERIFICATION_PACKAGE_BADGE_CLASS,
  VERIFICATION_PACKAGE_LABELS,
  gradeTierLabel,
} from "@/lib/labels";
import { extractPsaCertNumber, lookupPsaCert, lookupPsaPopulation, psaCertUrl } from "@/lib/psa";
import { lookupCardPrice } from "@/lib/tcg-price";
import { buildMarketQuery, lookupEbayPrice } from "@/lib/ebay";
import { cn } from "@/lib/utils";
import { realPhotos } from "@/lib/card-image";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [asset, user] = await Promise.all([getAssetById(id), getCurrentUser()]);

  if (!asset) notFound();

  const gradeTier = gradeTierLabel(asset.gradingCompany, asset.grade, asset.isBlackLabel);

  // Grade-aware, e.g. "Charizard VMAX PSA 10" — narrows eBay's own fuzzy
  // search to comps that are actually the same grading tier as this listing.
  const ebayQuery = buildMarketQuery(asset.name, asset.gradingCompany, asset.grade);

  // These five are all independent of each other (only psaPopulation below
  // depends on one of them) — awaiting them one at a time was serializing
  // several real external network round trips (PSA, TCG API, eBay) on every
  // page load, which is what was pushing this page to 5-10s and occasionally
  // outrunning the client's patience ("destination stream closed early").
  // Running them concurrently caps the wait at the slowest single call.
  const [psaCert, priceQuote, ebayQuote, priceHistory, sellerRating, similarAssets, cardMarket, insightData] = await Promise.all([
    // Live PSA cert lookup for display — best-effort, and never blocks the
    // page: it silently returns null whenever PSA isn't configured, the
    // account isn't approved for live access yet, or the request fails.
    asset.gradingCompany === "PSA" ? lookupPsaCert(extractPsaCertNumber(asset.serial)) : Promise.resolve(null),
    // Reference raw-card market price — TCG API (TCGPlayer data), Pokemon/TCG
    // only, so this only ever runs for TRADING_CARD. No grade-tier pricing
    // exists in that data at all, so it's deliberately never shown as "the"
    // price for a graded slab — see the disclaimer rendered alongside it.
    asset.category === "TRADING_CARD" ? lookupCardPrice(asset.name) : Promise.resolve(null),
    // Live current-asking-price reference from eBay's Browse API — covers
    // every category (sports cards, comics too, not just Pokemon), and is
    // grade-aware (with a bare-name fallback if the grade-qualified search
    // finds nothing — see lib/ebay.ts). Best-effort: null whenever eBay
    // isn't configured or nothing matched: ebaySoldListingsUrl below still
    // gives a real, verifiable price reference either way.
    lookupEbayPrice(asset.name, asset.gradingCompany, asset.grade),
    // Default range matches PriceHistoryChart's own default state (7d) — the
    // client re-fetches on range change, this is just the initial paint.
    getPriceHistory(asset.id, "7d"),
    getSellerRating(asset.seller.id),
    getSimilarAssets({
      id: asset.id,
      name: asset.name,
      gradingCompany: asset.gradingCompany,
      grade: asset.grade,
      priceThb: asset.priceThb,
    }),
    getCardMarketStats({ name: asset.name, gradingCompany: asset.gradingCompany, grade: asset.grade }),
    getAssetInsightData(asset.id),
  ]);

  const psaPopulation = psaCert?.specId != null ? await lookupPsaPopulation(psaCert.specId) : null;
  const sellerInitials = (asset.seller.name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // A completed (RELEASED) purchase of THIS asset, made by the current
  // user, that doesn't have a review yet — real gate, not just "did you buy
  // something from this seller ever."
  const reviewableEscrow = asset.escrowTxs.find(
    (tx) => tx.buyerId === user.id && tx.status === "RELEASED" && !tx.review,
  );

  const isOwner = asset.ownerId === user.id;
  const isWatching = !isOwner && (await isAssetWatched(user.id, asset.id));

  // Card swaps are vault-to-vault only — see proposeTrade in lib/actions.ts.
  const swappable =
    !isOwner &&
    asset.vaulted &&
    !asset.redeemedAt &&
    asset.marketStatus !== "IN_ESCROW" &&
    asset.marketStatus !== "IN_AUCTION";

  const [activeAuction, acceptedOffer, mySwappableCards, escrowAuthorityAddress] = await Promise.all([
    asset.marketStatus === "IN_AUCTION" ? getActiveAuctionForAsset(asset.id) : Promise.resolve(null),
    !isOwner ? getAcceptedOfferForViewer(asset.id, user.id) : Promise.resolve(null),
    swappable ? getMySwappableAssets(user.id) : Promise.resolve([]),
    swappable ? getEscrowAuthorityAddress() : Promise.resolve(null),
  ]);

  const insights = buildPriceInsights({
    priceThb: asset.priceThb,
    forSale: asset.forSale,
    gradingCompany: asset.gradingCompany,
    grade: asset.grade,
    isBlackLabel: asset.isBlackLabel,
    snapshots: insightData.snapshots,
    watcherCount: insightData.watcherCount,
    pendingOffers: insightData.pendingOffers,
    market: cardMarket,
    psa: psaCert ? { totalPopulation: psaCert.totalPopulation, populationHigher: psaCert.populationHigher } : null,
  });
  const gradeLabel =
    asset.gradingCompany === "RAW"
      ? "Raw / ungraded"
      : `${asset.gradingCompany} ${formatGrade(asset.grade)}${asset.isBlackLabel ? " Black Label" : ""}`;
  const wantedDefaults = {
    query: asset.name,
    gradingCompany: asset.gradingCompany,
    minGrade: asset.gradingCompany === "RAW" ? null : asset.grade,
    blackLabelOnly: asset.isBlackLabel,
  };

  // The price snapshot immediately before the current one, from the same
  // real PriceSnapshot rows the chart below uses — null for a brand-new
  // listing with only one snapshot so far (shown as "—", not fabricated).
  const previousPriceThb =
    priceHistory.length >= 2 ? priceHistory[priceHistory.length - 2].priceThb : null;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Button asChild variant="outline" className="mb-6">
        <Link href="/marketplace">
          <ArrowLeft />
          Back to Marketplace
        </Link>
      </Button>

      {/* items-start — without it, CSS Grid stretches the shorter info
          column to match the (usually much taller) image column's height,
          which just left a dead black gap below the last card on the right. */}
      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ItemGallery
            themeIndex={asset.themeIndex}
            category={asset.category}
            gradingCompany={asset.gradingCompany}
            grade={asset.grade}
            isBlackLabel={asset.isBlackLabel}
            photos={realPhotos(asset.verificationPhotos)}
            referenceImageUrl={asset.catalogImageUrl}
          />
        </div>

        <div className="flex flex-col gap-5">
          {/* Top pill row — category / vault / verification package, plus watch */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                {CARD_GAME_LABELS[asset.game]}
              </Badge>
              {asset.vaulted && (
                <Badge variant="secondary" className="rounded-full">
                  In Platform Vault
                </Badge>
              )}
              <Badge className={cn("rounded-full border-0", VERIFICATION_PACKAGE_BADGE_CLASS[asset.verificationPackage])}>
                {VERIFICATION_PACKAGE_LABELS[asset.verificationPackage]}
              </Badge>
            </div>
            {!isOwner && <WatchButton assetId={asset.id} initialWatching={isWatching} />}
          </div>

          {/* Title block — small certification caption above the name, price
              and status pinned to the right, mirroring a graded-card listing
              page's hierarchy: what it is graded, what it's called, what it
              costs, all in one glance. */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                {asset.gradingCompany === "RAW"
                  ? "Raw / Ungraded — verified by camera"
                  : `${asset.gradingCompany} ${formatGrade(asset.grade)}${gradeTier ? ` · ${gradeTier}` : ""}`}
                {asset.isBlackLabel && (
                  <span className="rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold normal-case tracking-wide text-neutral-900">
                    Black Label
                  </span>
                )}
              </span>
              <h1 className="text-2xl font-semibold">{asset.name}</h1>
              <p className="text-muted-foreground text-sm">{asset.subtitle}</p>
              {asset.gradingCompany === "PSA" && (
                <a
                  href={psaCertUrl(extractPsaCertNumber(asset.serial))}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground mt-1 inline-flex w-fit items-center gap-1 text-xs underline underline-offset-2"
                >
                  View on PSA <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge className={cn("border-0", MARKET_STATUS_BADGE_CLASS[asset.marketStatus])}>
                {MARKET_STATUS_LABELS[asset.marketStatus]}
              </Badge>
              {asset.priceThb != null && (
                <span className="text-xl leading-none font-bold tabular-nums">{formatThb(asset.priceThb)}</span>
              )}
            </div>
          </div>

          {/* Owner / serial / on-chain mint — the same three facts a
              blockchain-native marketplace leads with (owner, address,
              token id), backed by this platform's own real SPL mint. */}
          <div className="detail-panel grid grid-cols-3 divide-x rounded-xl border text-sm">
            <div className="flex min-w-0 flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">Owned by</span>
              <Link href={`/store/${asset.owner.id}`} className="truncate font-medium hover:underline">
                {asset.owner.name}
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">Serial</span>
              <span className="truncate font-mono">{asset.serial}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">Mint Address</span>
              {asset.mintAddress ? (
                <a
                  href={`https://explorer.solana.com/address/${asset.mintAddress}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono hover:underline"
                >
                  {asset.mintAddress.slice(0, 4)}…{asset.mintAddress.slice(-4)}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          {/* Price stat box, same shape as the owner/serial row above — the
              second figure comes from a real prior PriceSnapshot, not a
              fabricated "last sale". Auctions/offers are a separate sale
              channel (see below) and don't feed into this fixed-price figure. */}
          <div className="detail-panel grid grid-cols-2 divide-x rounded-xl border">
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">Listing Price</span>
              <span className="text-lg leading-none font-bold tabular-nums">
                {asset.priceThb != null ? formatThb(asset.priceThb) : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">Previous Price</span>
              <span className="text-lg leading-none font-bold tabular-nums">
                {previousPriceThb != null ? formatThb(previousPriceThb) : "—"}
              </span>
            </div>
          </div>

          {asset.redeemedAt ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
              <Flame className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">Redeemed on {formatDate(asset.redeemedAt)}.</span>{" "}
                <span className="text-muted-foreground">
                  The physical card was shipped to its owner and its digital twin was burned, so it can no longer be
                  bought, auctioned or swapped here.
                </span>
              </p>
            </div>
          ) : activeAuction ? (
            <Link
              href={`/auctions/${activeAuction.id}`}
              className="bg-foreground text-background flex items-center gap-3 rounded-xl p-4 transition-opacity hover:opacity-90"
            >
              <Gavel className="size-5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold">This item is up for auction</span>
                <span className="text-background/80 text-sm">
                  {activeAuction.currentBidThb != null
                    ? `Current bid ${formatThb(activeAuction.currentBidThb)}`
                    : `Starting at ${formatThb(activeAuction.startPriceThb)}`}{" "}
                  — view the live auction to bid
                </span>
              </div>
            </Link>
          ) : (
            <>
              {acceptedOffer && (
                <AcceptedOfferBanner
                  offerId={acceptedOffer.id}
                  amountThb={acceptedOffer.amountThb}
                  vaulted={asset.vaulted}
                  sellerWalletAddress={asset.owner.walletAddress}
                />
              )}
              <BuyPanel
                assetId={asset.id}
                assetName={asset.name}
                priceThb={asset.priceThb}
                forSale={asset.forSale}
                vaulted={asset.vaulted}
                marketStatus={asset.marketStatus}
                isOwner={isOwner}
                sellerWalletAddress={asset.owner.walletAddress}
              />
              {!isOwner && asset.forSale && (
                <MakeOfferButton
                  assetId={asset.id}
                  assetName={asset.name}
                  listPriceThb={asset.priceThb}
                  size="default"
                  variant="secondary"
                  className="w-full"
                />
              )}
              {swappable && (
                <ProposeSwapButton
                  requestedAsset={{ id: asset.id, name: asset.name, priceThb: asset.forSale ? asset.priceThb : null }}
                  recipientWalletAddress={asset.owner.walletAddress}
                  myCards={mySwappableCards}
                  escrowAuthorityAddress={escrowAuthorityAddress}
                />
              )}
            </>
          )}
          {!isOwner && (
            <WantedCardButton
              defaults={wantedDefaults}
              label={asset.forSale ? "Notify me about other copies" : "Notify me when listed"}
              className="w-full"
              variant="outline"
            />
          )}

          <PriceHistoryChart
            assetId={asset.id}
            initialHistory={priceHistory.map((p) => ({ priceThb: p.priceThb, createdAt: p.createdAt.toISOString() }))}
            currentPriceThb={asset.priceThb}
          />

          <Link
            href={`/store/${asset.seller.id}`}
            className="detail-panel hover:bg-highlight/15 flex items-center gap-3 rounded-xl border p-3 transition-colors"
          >
            <Avatar className="size-10 shrink-0">
              {asset.seller.image && <AvatarImage src={asset.seller.image} alt={asset.seller.name ?? ""} />}
              <AvatarFallback className="text-sm font-medium">{sellerInitials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Listed by</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">{asset.seller.name}</span>
                <VerifiedBadge status={asset.seller.kycStatus} />
              </span>
              <RatingStars average={sellerRating.average} count={sellerRating.count} />
            </div>
          </Link>
          {/* Messages go to the current owner — the person who can actually
              accept an offer or change the price. */}
          {!isOwner && <MessageSellerButton sellerId={asset.owner.id} className="w-full" />}
          {asset.owner.id !== asset.seller.id && (
            <p className="text-muted-foreground text-xs">
              Currently owned by{" "}
              <Link href={`/store/${asset.owner.id}`} className="text-foreground font-medium hover:underline">
                {asset.owner.name}
              </Link>
            </p>
          )}

          {reviewableEscrow && <LeaveReviewForm escrowTxId={reviewableEscrow.id} />}

          {/* Collapsible key-value spec sheet — every field the old grade
              seal + PSA panel showed, just laid out as rows instead of a
              separate solid badge and a separate card. */}
          <details className="detail-panel group rounded-xl border" open>
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">
              Card Details
              <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">Game</dt>
                <dd className="font-medium">{CARD_GAME_LABELS[asset.game]}</dd>
              </div>
              {asset.gradingCompany !== "RAW" && (
                <>
                  <div>
                    <dt className="text-muted-foreground text-xs">Grader</dt>
                    <dd className="font-medium">{asset.gradingCompany}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Grade</dt>
                    <dd className="font-medium">
                      {formatGrade(asset.grade)}
                      {gradeTier ? ` — ${gradeTier}` : ""}
                      {asset.isBlackLabel ? " (Black Label)" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Serial</dt>
                    <dd className="font-mono font-medium">{asset.serial}</dd>
                  </div>
                </>
              )}
              {psaCert?.year && (
                <div>
                  <dt className="text-muted-foreground text-xs">Year</dt>
                  <dd className="font-medium">{psaCert.year}</dd>
                </div>
              )}
              {psaCert?.brand && (
                <div>
                  <dt className="text-muted-foreground text-xs">Brand / Set</dt>
                  <dd className="font-medium">{psaCert.brand}</dd>
                </div>
              )}
              {psaCert?.cardNumber && (
                <div>
                  <dt className="text-muted-foreground text-xs">Card # (PSA)</dt>
                  <dd className="font-mono font-medium">{psaCert.cardNumber}</dd>
                </div>
              )}
              {psaCert?.variety && (
                <div>
                  <dt className="text-muted-foreground text-xs">Variety</dt>
                  <dd className="font-medium">{psaCert.variety}</dd>
                </div>
              )}
              {psaCert?.gradeDescription && (
                <div>
                  <dt className="text-muted-foreground text-xs">Grade Description</dt>
                  <dd className="font-medium">{psaCert.gradeDescription}</dd>
                </div>
              )}
              {psaCert?.totalPopulation != null && (
                <div>
                  <dt className="text-muted-foreground text-xs">Population at Grade</dt>
                  <dd className="font-medium">{psaCert.totalPopulation.toLocaleString()}</dd>
                </div>
              )}
              {psaCert?.populationHigher != null && (
                <div>
                  <dt className="text-muted-foreground text-xs">Population Higher</dt>
                  <dd className="font-medium">{psaCert.populationHigher.toLocaleString()}</dd>
                </div>
              )}
              {psaPopulation?.total != null && (
                <div>
                  <dt className="text-muted-foreground text-xs">Total Pop. (All Grades)</dt>
                  <dd className="font-medium">{psaPopulation.total.toLocaleString()}</dd>
                </div>
              )}
            </dl>
            {psaCert && (
              <p className="text-muted-foreground border-t px-4 py-3 text-[11px]">
                Grader detail sourced live from PSA&apos;s public Cert Verification API
                {psaCert.itemStatus ? ` — status: ${psaCert.itemStatus}.` : "."} PSA does not publish a price
                guide through this API, so no market value is shown here — see Price Comparison below.
              </p>
            )}
          </details>
        </div>
      </div>

      {/* Everything below is supporting evidence for the decision already
          made above — verification detail and price data a buyer can dig
          into, not required reading before they can act. */}
      <Separator className="my-10" />

      <PlatformPriceTable
        priceThb={asset.priceThb}
        forSale={asset.forSale}
        gradeLabel={gradeLabel}
        marketQuery={ebayQuery}
        cardMart={cardMarket}
        tcg={priceQuote}
        ebay={ebayQuote}
      />

      <div className="mt-10 grid grid-cols-1 items-start gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <PriceInsights insights={insights} />
        </div>

        <div>
          <div className="mb-5 flex items-center gap-2">
            <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
              <History className="size-3.5" />
            </div>
            <h2 className="text-lg font-semibold">Item History</h2>
          </div>
          <ProvenanceTimeline events={asset.provenance} />
        </div>
      </div>

      {similarAssets.length > 0 && (
        <>
          <Separator className="my-10" />
          <SimilarListings currentPriceThb={asset.priceThb} listings={similarAssets} />
        </>
      )}
    </div>
  );
}
