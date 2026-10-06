import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAcceptedOfferForViewer,
  getActiveAuctionForAsset,
  getShipmentForRecipient,
  getAssetById,
  getAssetInsightData,
  getCardMarketStats,
  getCardAcrossGrades,
  getPriceHistory,
  getSellerRating,
  getSimilarAssets,
  isAssetWatched,
} from "@/lib/queries";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { buildPriceInsights } from "@/lib/insights";
import { PriceInsights } from "@/components/item/price-insights";
import { WantedCardButton } from "@/components/wanted/wanted-card-form";
import { VerifiedBadge } from "@/components/store/verified-badge";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { ItemGallery } from "@/components/item/item-gallery";
import { MarketPriceHistory } from "@/components/item/market-price-history";
import { ProvenanceTimeline } from "@/components/item/provenance-timeline";
import { BuyPanel } from "@/components/item/buy-panel";
import { WatchButton } from "@/components/item/watch-button";
import { MessageSellerButton } from "@/components/messages/message-seller-button";
import { AcceptedOfferBanner } from "@/components/item/accepted-offer-banner";
import { SimilarListings, type SimilarListing } from "@/components/item/similar-listings";
import { THB_PER_USD } from "@/lib/pricing";
import { LeaveReviewForm } from "@/components/store/leave-review-form";
import { ReportProblem } from "@/components/item/report-problem";
import { ShipmentTracking } from "@/components/item/shipment-tracking";
import { isWithinDisputeWindow, toSaleToShip } from "@/lib/shipping";
import { expireOverdueSellerShipments } from "@/lib/actions";
import { OrderProgress } from "@/components/item/order-progress";
import { ShipToWarehouseTask } from "@/components/portfolio/ship-to-warehouse";
import { RatingStars } from "@/components/store/rating-stars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronLeft, ExternalLink, Flame, Gavel } from "lucide-react";

import { formatDate, formatGrade, formatThb } from "@/lib/format";
import {
  CARD_GAME_BADGE_CLASS,
  CARD_GAME_LABELS,
  CARD_LANGUAGE_BADGE_CLASS,
  CARD_LANGUAGE_LABELS,
  MARKET_STATUS_BADGE_CLASS,
  MARKET_STATUS_LABELS,
  VERIFICATION_PACKAGE_BADGE_CLASS,
  VERIFICATION_PACKAGE_LABELS,
  gradeTierLabel,
} from "@/lib/labels";
import { extractPsaCertNumber, isPsaCertNumber, lookupPsaCert, lookupPsaPopulation, psaCertUrl } from "@/lib/psa";
import { lookupCardPrice } from "@/lib/tcg-price";
import { buildMarketQuery, lookupEbayPrice } from "@/lib/ebay";
import { tierKey, type GradeTier } from "@/lib/grade-tier";
import { cn } from "@/lib/utils";
import { displayImage, realPhotos } from "@/lib/card-image";

const PRELOADED_EBAY_TIERS: GradeTier[] = [
  { gradingCompany: "RAW", grade: null, isBlackLabel: false },
  { gradingCompany: "PSA", grade: 9, isBlackLabel: false },
  { gradingCompany: "PSA", grade: 10, isBlackLabel: false },
];

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Cancel any sale whose seller missed the shipping deadline before reading
  // the item, so its status below is never stale.
  await expireOverdueSellerShipments({ revalidate: false });
  const [asset, user, t] = await Promise.all([getAssetById(id), getCurrentUser(), getT()]);

  if (!asset) notFound();

  const gradeTier = gradeTierLabel(asset.gradingCompany, asset.grade, asset.isBlackLabel);
  // The tier name without its number, which the caption already shows
  // ("PSA 9 · Mint", not "PSA 9 · Mint 9"). Black Label has its own pill.
  const gradeTierName = gradeTier?.replace(/ \(Black Label\)$/, "").replace(/ \d+(\.\d+)?$/, "") ?? null;
  const psaCertNumber = asset.gradingCompany === "PSA" ? extractPsaCertNumber(asset.serial) : null;

  // This exact card: name, set, grader + grade (+ Black Label), e.g.
  // "Lugia Holo 1st Edition Neo Genesis PSA 10". Every price source below
  // compares against the same card in the same grade, never a look-alike.
  const marketCard = {
    name: asset.name,
    subtitle: asset.subtitle,
    gradingCompany: asset.gradingCompany,
    grade: asset.grade,
    isBlackLabel: asset.isBlackLabel,
    cardNumber: asset.cardNumber,
  };
  // eBay prices preloaded for the grade picker: raw, PSA 9 and PSA 10. This
  // listing's own grade reuses ebayQuote below; any other grade loads when picked.
  const currentTier = { gradingCompany: asset.gradingCompany, grade: asset.grade, isBlackLabel: asset.isBlackLabel };
  const otherTiers = PRELOADED_EBAY_TIERS.filter((tier) => tierKey(tier) !== tierKey(currentTier));

  // These five are all independent of each other (only psaPopulation below
  // depends on one of them) — awaiting them one at a time was serializing
  // several real external network round trips (PSA, TCG API, eBay) on every
  // page load, which is what was pushing this page to 5-10s and occasionally
  // outrunning the client's patience ("destination stream closed early").
  // Running them concurrently caps the wait at the slowest single call.
  const [psaCert, priceQuote, ebayQuote, priceHistory, sellerRating, similarAssets, cardMarket, insightData, gradeData, otherTierEbay] = await Promise.all([
    // Live PSA cert lookup for display — best-effort, and never blocks the
    // page: it silently returns null whenever PSA isn't configured, the
    // account isn't approved for live access yet, or the request fails.
    asset.gradingCompany === "PSA" ? lookupPsaCert(extractPsaCertNumber(asset.serial)) : Promise.resolve(null),
    // Reference raw-card market price — TCG API (TCGPlayer data), Pokemon/TCG
    // only, so this only ever runs for TRADING_CARD. No grade-tier pricing
    // exists in that data at all, so it's deliberately never shown as "the"
    // price for a graded slab — see the disclaimer rendered alongside it.
    asset.category === "TRADING_CARD" ? lookupCardPrice(asset.name) : Promise.resolve(null),
    // Live current-asking-price reference from eBay's Browse API, counting
    // only listings of this exact card in this exact grade (see lib/ebay.ts).
    // Best-effort: null whenever eBay isn't configured or nothing matched
    // exactly; ebaySoldListingsUrl below still gives a verifiable reference.
    lookupEbayPrice(marketCard),
    // Only feeds the Previous Price box; the full history comes from insightData.
    getPriceHistory(asset.id, "7d"),
    getSellerRating(asset.seller.id),
    getSimilarAssets({ id: asset.id, name: asset.name, subtitle: asset.subtitle }),
    getCardMarketStats(marketCard, asset.id),
    getAssetInsightData(asset.id),
    getCardAcrossGrades(marketCard),
    Promise.all(otherTiers.map((tier) => lookupEbayPrice({ ...marketCard, ...tier }).catch(() => null))),
  ]);
  const preloadedEbay: Record<string, Awaited<typeof ebayQuote>> = Object.fromEntries([
    [tierKey(currentTier), ebayQuote],
    ...otherTiers.map((tier, i) => [tierKey(tier), otherTierEbay[i]] as const),
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

  // The viewer's most recent completed purchase of this item — the one they
  // can report a problem with (see openDispute). The form is offered for
  // DISPUTE_WINDOW_DAYS after the sale; an existing report stays visible after that.
  const myCompletedPurchase = asset.escrowTxs.find((tx) => tx.buyerId === user.id && tx.status === "RELEASED");
  const canReportProblem =
    myCompletedPurchase?.releasedAt != null &&
    (myCompletedPurchase.dispute != null ||
      isWithinDisputeWindow(myCompletedPurchase.releasedAt));

  const isOwner = asset.ownerId === user.id;

  // A sale of this item still in escrow — shown to the buyer as order
  // progress, and to the seller as the "ship it to us" task.
  const openSale = asset.escrowTxs.find((tx) => tx.status === "LOCKED" && tx.inboundPackage);
  const myOpenOrder = openSale?.buyerId === user.id ? openSale : null;
  const saleToShip =
    openSale?.sellerId === user.id &&
    openSale.inboundPackage &&
    (openSale.inboundPackage.status === "AWAITING_SELLER_SHIPMENT" || openSale.inboundPackage.status === "PENDING_INSPECTION")
      ? toSaleToShip({ ...openSale.inboundPackage, asset, escrowTx: openSale })
      : null;
  const isWatching = !isOwner && (await isAssetWatched(user.id, asset.id));

  const [activeAuction, acceptedOffer, escrowAuthorityAddress, myShipment] = await Promise.all([
    asset.marketStatus === "IN_AUCTION" ? getActiveAuctionForAsset(asset.id) : Promise.resolve(null),
    !isOwner ? getAcceptedOfferForViewer(asset.id, user.id) : Promise.resolve(null),
    getEscrowAuthorityAddress(),
    isOwner ? getShipmentForRecipient(asset.id, user.id) : Promise.resolve(null),
  ]);

  // A fair price for this card in a grade, for the Similar Listings badges:
  // eBay's median ask when we have it, else the CardMart median sale.
  const estimateFor = (tier: GradeTier) => {
    const quote = preloadedEbay[tierKey(tier)];
    if (quote) return Math.round(quote.medianPriceUsd * THB_PER_USD);
    const sold = gradeData.sales
      .filter((sale) => tierKey(sale) === tierKey(tier))
      .map((sale) => sale.amountThb)
      .sort((a, b) => a - b);
    return sold.length ? sold[Math.floor((sold.length - 1) / 2)] : null;
  };
  const toSimilar = (
    a: Pick<typeof asset, "id" | "name" | "subtitle" | "themeIndex" | "category" | "gradingCompany" | "grade" | "isBlackLabel" | "verificationPhotos" | "catalogImageUrl"> & {
      priceThb: number;
      seller: { name: string | null };
    },
    viewing = false,
  ): SimilarListing => ({
    id: a.id,
    name: a.name,
    subtitle: a.subtitle,
    priceThb: a.priceThb,
    imageUrl: displayImage(a)?.url ?? null,
    themeIndex: a.themeIndex,
    category: a.category,
    gradingCompany: a.gradingCompany,
    grade: a.grade,
    isBlackLabel: a.isBlackLabel,
    sellerName: a.seller.name ?? "",
    estimateThb: estimateFor(a),
    viewing,
  });
  const similarListings = [
    ...(asset.forSale && asset.priceThb != null ? [toSimilar({ ...asset, priceThb: asset.priceThb }, true)] : []),
    ...similarAssets.map((a) => toSimilar({ ...a, priceThb: a.priceThb! })),
  ];

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
  }, t);
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
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb back link — where you came from, then this card. */}
      <nav className="text-muted-foreground mb-6 flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href="/marketplace"
          title={t("Back to Market")}
          className="hover:text-foreground inline-flex shrink-0 items-center gap-1 transition-colors"
        >
          <ChevronLeft className="size-4" />
          {t("Market")}
        </Link>
        <span>/</span>
        <span className="shrink-0">{t(CARD_GAME_LABELS[asset.game])}</span>
        <span>/</span>
        <span className="text-foreground truncate">{asset.name}</span>
      </nav>

      {/* items-start — without it, CSS Grid stretches the shorter info
          column to match the (usually much taller) image column's height,
          which just left a dead black gap below the last card on the right. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        {/* The image stays in view while the info column scrolls past it. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
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
              <Badge className={cn("rounded-md border-0", CARD_GAME_BADGE_CLASS[asset.game])}>
                {t(CARD_GAME_LABELS[asset.game])}
              </Badge>
              <Badge className={cn("rounded-md border-0", CARD_LANGUAGE_BADGE_CLASS[asset.language])}>
                {t(CARD_LANGUAGE_LABELS[asset.language])}
              </Badge>
              {asset.vaulted && (
                <Badge variant="secondary" className="rounded-md">
                  {t("In Platform Vault")}
                </Badge>
              )}
              <Badge className={cn("rounded-md border-0", VERIFICATION_PACKAGE_BADGE_CLASS[asset.verificationPackage])}>
                {t(VERIFICATION_PACKAGE_LABELS[asset.verificationPackage])}
              </Badge>
            </div>
            {!isOwner && (
              <div className="flex items-center gap-2">
                <WantedCardButton
                  defaults={wantedDefaults}
                  label={asset.forSale ? t("Notify me about other copies") : t("Notify me when listed")}
                  size="sm"
                />
                <WatchButton assetId={asset.id} initialWatching={isWatching} />
              </div>
            )}
          </div>

          {/* Title block — small certification caption above the name, price
              and status pinned to the right, mirroring a graded-card listing
              page's hierarchy: what it is graded, what it's called, what it
              costs, all in one glance. */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="eyebrow text-muted-foreground flex flex-wrap items-center gap-1.5">
                {asset.gradingCompany === "RAW"
                  ? t("Raw / Ungraded — verified by camera")
                  : `${asset.gradingCompany} ${formatGrade(asset.grade)}${gradeTierName ? ` · ${gradeTierName}` : ""}`}
                {asset.isBlackLabel && (
                  <span className="rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold normal-case tracking-wide text-neutral-900">
                    Black Label
                  </span>
                )}
              </span>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{asset.name}</h1>
              <p className="text-muted-foreground text-sm">
                {asset.subtitle}
                {asset.cardNumber && <span className="font-mono"> · #{asset.cardNumber}</span>}
              </p>
              {psaCertNumber && isPsaCertNumber(psaCertNumber) && (
                <a
                  href={psaCertUrl(psaCertNumber)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground mt-1 inline-flex w-fit items-center gap-1 text-xs underline underline-offset-2"
                >
                  {t("View on PSA")} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {/* The price lives in the Listing Price box below (and on the Buy
                button), so only the status sits up here. */}
            <Badge className={cn("shrink-0 rounded-md border-0", MARKET_STATUS_BADGE_CLASS[asset.marketStatus])}>
              {t(MARKET_STATUS_LABELS[asset.marketStatus])}
            </Badge>
          </div>

          {/* Owner / serial / on-chain mint — the same three facts a
              blockchain-native marketplace leads with (owner, address,
              token id), backed by this platform's own real SPL mint. */}
          {/* A raw card has no grading company, so no cert serial to show. */}
          <div
            className={cn(
              "detail-panel grid divide-x rounded-2xl border text-sm",
              ["grid-cols-1", "grid-cols-2", "grid-cols-3"][
                (asset.gradingCompany === "RAW" ? 0 : 1) + (asset.mintAddress ? 1 : 0)
              ],
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5 p-3">
              <span className="text-muted-foreground text-xs">{t("Owned by")}</span>
              <Link href={`/store/${asset.owner.id}`} className="truncate font-medium hover:underline">
                {asset.owner.name}
              </Link>
            </div>
            {asset.gradingCompany !== "RAW" && (
              <div className="flex min-w-0 flex-col gap-0.5 p-3">
                <span className="text-muted-foreground text-xs">{t("Serial")}</span>
                <span className="truncate font-mono">{asset.serial}</span>
              </div>
            )}
            {asset.mintAddress && (
              <div className="flex min-w-0 flex-col gap-0.5 p-3">
                <span className="text-muted-foreground text-xs">{t("Mint Address")}</span>
                <a
                  href={`https://explorer.solana.com/address/${asset.mintAddress}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono hover:underline"
                >
                  {asset.mintAddress.slice(0, 4)}…{asset.mintAddress.slice(-4)}
                </a>
              </div>
            )}
          </div>

          {/* Price stat box, same shape as the owner/serial row above — the
              second figure comes from a real prior PriceSnapshot, not a
              fabricated "last sale". Auctions/offers are a separate sale
              channel (see below) and don't feed into this fixed-price figure. */}
          <div
            className={cn(
              "detail-panel grid divide-x rounded-2xl border",
              previousPriceThb != null ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <div className="flex flex-col gap-1.5 p-4">
              <span className="eyebrow text-muted-foreground">{t("Listing Price")}</span>
              <span className="text-3xl leading-none font-bold tabular-nums">
                {asset.priceThb != null ? formatThb(asset.priceThb) : "—"}
              </span>
            </div>
            {previousPriceThb != null && (
              <div className="flex flex-col gap-1.5 p-4">
                <span className="eyebrow text-muted-foreground">{t("Previous Price")}</span>
                <span className="text-muted-foreground text-3xl leading-none font-bold tabular-nums">{formatThb(previousPriceThb)}</span>
              </div>
            )}
          </div>

          {/* Seller card, kept above the buy actions since who you're buying
              from matters before you pay: the name links to their store, and
              messaging sits right on the card. Messages go to the current
              owner — the person who can actually accept an offer or change
              the price. */}
          <div className="flex flex-col gap-2">
            <div className="detail-panel flex items-center gap-3 rounded-2xl border p-4">
              <Link href={`/store/${asset.seller.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="size-10 shrink-0">
                  {asset.seller.image && <AvatarImage src={asset.seller.image} alt={asset.seller.name ?? ""} />}
                  <AvatarFallback className="text-sm font-medium">{sellerInitials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">{t("Listed by")}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold group-hover:underline">{asset.seller.name}</span>
                    <VerifiedBadge status={asset.seller.kycStatus} />
                  </span>
                  <RatingStars average={sellerRating.average} count={sellerRating.count} />
                </div>
              </Link>
              {!isOwner && (
                <MessageSellerButton
                  sellerId={asset.owner.id}
                  assetId={asset.id}
                  variant="default"
                  className="bg-highlight text-highlight-foreground hover:bg-highlight/85 shrink-0"
                />
              )}
            </div>
            {asset.owner.id !== asset.seller.id && (
              <p className="text-muted-foreground text-xs">
                {t("Currently owned by")}{" "}
                <Link href={`/store/${asset.owner.id}`} className="text-foreground font-medium hover:underline">
                  {asset.owner.name}
                </Link>
              </p>
            )}
          </div>

          {asset.redeemedAt ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
              <Flame className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">{t("Redeemed on {date}.", { date: formatDate(asset.redeemedAt) })}</span>{" "}
                <span className="text-muted-foreground">
                  {t("The physical card was shipped to its owner and its digital twin was burned, so it can no longer be bought, auctioned or swapped here.")}
                </span>
              </p>
            </div>
          ) : activeAuction ? (
            <Link
              href={`/auctions/${activeAuction.id}`}
              className="bg-foreground text-background flex items-center gap-3 rounded-2xl p-4 transition-opacity hover:opacity-90"
            >
              <Gavel className="size-5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold">{t("This item is up for auction")}</span>
                <span className="text-background/80 text-sm">
                  {activeAuction.currentBidThb != null
                    ? t("Current bid {amount}", { amount: formatThb(activeAuction.currentBidThb) })
                    : t("Starting at {amount}", { amount: formatThb(activeAuction.startPriceThb) })}{" "}
                  — {t("view the live auction to bid")}
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
                  platformWalletAddress={escrowAuthorityAddress}
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
                platformWalletAddress={escrowAuthorityAddress}
                awaitingSellerApproval={Boolean(
                  asset.mintAddress && !asset.transferApproved && asset.owner.walletAddress && escrowAuthorityAddress,
                )}
              />
            </>
          )}

          {myOpenOrder?.inboundPackage && (
            <OrderProgress
              pkg={myOpenOrder.inboundPackage}
              amountThb={myOpenOrder.amountThb}
              fulfillment={myOpenOrder.fulfillmentChoice}
              paidAt={myOpenOrder.createdAt}
            />
          )}
          {saleToShip && <ShipToWarehouseTask sale={saleToShip} />}
          {myShipment && <ShipmentTracking shipment={myShipment} />}

          {reviewableEscrow && <LeaveReviewForm escrowTxId={reviewableEscrow.id} />}

          {canReportProblem && myCompletedPurchase && (
            <ReportProblem
              escrowTxId={myCompletedPurchase.id}
              dispute={
                myCompletedPurchase.dispute && {
                  reason: myCompletedPurchase.dispute.reason,
                  status: myCompletedPurchase.dispute.status,
                  resolutionNote: myCompletedPurchase.dispute.resolutionNote,
                }
              }
            />
          )}

          {/* Grader detail from the live PSA lookup — year, set, population.
              Game, grade and serial are already shown above, so this only
              appears when PSA returned something new. */}
          {psaCert && (
            <details className="detail-panel group rounded-2xl border" open>
              <summary className="eyebrow flex cursor-pointer list-none items-center justify-between p-4">
                {t("Card Details")}
                <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
              </summary>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t p-4 text-sm sm:grid-cols-3">
                {psaCert.year && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Year")}</dt>
                    <dd className="font-medium">{psaCert.year}</dd>
                  </div>
                )}
                {psaCert.brand && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Brand / Set")}</dt>
                    <dd className="font-medium">{psaCert.brand}</dd>
                  </div>
                )}
                {psaCert.cardNumber && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Card # (PSA)")}</dt>
                    <dd className="font-mono font-medium">{psaCert.cardNumber}</dd>
                  </div>
                )}
                {psaCert.variety && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Variety")}</dt>
                    <dd className="font-medium">{psaCert.variety}</dd>
                  </div>
                )}
                {psaCert.gradeDescription && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Grade Description")}</dt>
                    <dd className="font-medium">{psaCert.gradeDescription}</dd>
                  </div>
                )}
                {psaCert.totalPopulation != null && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Population at Grade")}</dt>
                    <dd className="font-medium">{psaCert.totalPopulation.toLocaleString()}</dd>
                  </div>
                )}
                {psaCert.populationHigher != null && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Population Higher")}</dt>
                    <dd className="font-medium">{psaCert.populationHigher.toLocaleString()}</dd>
                  </div>
                )}
                {psaPopulation?.total != null && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("Total Pop. (All Grades)")}</dt>
                    <dd className="font-medium">{psaPopulation.total.toLocaleString()}</dd>
                  </div>
                )}
              </dl>
              <p className="text-muted-foreground border-t px-4 py-3 text-[11px]">
                {t("Grader detail sourced live from PSA's public Cert Verification API")}
                {psaCert.itemStatus ? ` — ${t("status:")} ${psaCert.itemStatus}.` : "."}{" "}
                {t("PSA does not publish a price guide through this API, so no market value is shown here — see Price Comparison below.")}
              </p>
            </details>
          )}
        </div>
      </div>

      {/* Everything below is supporting evidence for the decision already
          made above — verification detail and price data a buyer can dig
          into, not required reading before they can act. */}
      <Separator className="my-12" />

      <MarketPriceHistory
        assetId={asset.id}
        current={currentTier}
        subtitle={asset.subtitle}
        sales={gradeData.sales.map((s) => ({ ...s, soldAt: s.soldAt.toISOString() }))}
        listingHistory={insightData.snapshots.map((p) => ({ priceThb: p.priceThb, createdAt: p.createdAt.toISOString() }))}
        listingThb={asset.forSale ? asset.priceThb : null}
        listings={gradeData.listings.filter((l) => l.id !== asset.id)}
        initialEbay={preloadedEbay}
        tcg={priceQuote?.marketPriceUsd != null ? { marketPriceUsd: priceQuote.marketPriceUsd, matchedName: priceQuote.matchedName } : null}
        baseQuery={buildMarketQuery({ ...marketCard, gradingCompany: "RAW", grade: null, isBlackLabel: false })}
      />

      <div className="mt-12">
        <PriceInsights insights={insights} />
      </div>

      <Separator className="my-12" />

      <ProvenanceTimeline events={asset.provenance} />

      {similarAssets.length > 0 && (
        <>
          <Separator className="my-12" />
          <SimilarListings listings={similarListings} />
        </>
      )}
    </div>
  );
}
