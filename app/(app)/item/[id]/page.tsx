import Link from "next/link";
import { notFound } from "next/navigation";

import { getAssetById, getPriceHistory, getSellerRating, isAssetWatched } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { ItemGallery } from "@/components/item/item-gallery";
import { PriceHistoryChart } from "@/components/item/price-history-chart";
import { ProvenanceTimeline } from "@/components/item/provenance-timeline";
import { BuyPanel } from "@/components/item/buy-panel";
import { WatchButton } from "@/components/item/watch-button";
import { LeaveReviewForm } from "@/components/store/leave-review-form";
import { RatingStars } from "@/components/store/rating-stars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, History, ScanSearch, TrendingUp } from "lucide-react";

import { formatGrade } from "@/lib/format";
import {
  CATEGORY_LABELS,
  MARKET_STATUS_BADGE_CLASS,
  MARKET_STATUS_LABELS,
  VERIFICATION_PACKAGE_BADGE_CLASS,
  VERIFICATION_PACKAGE_LABELS,
} from "@/lib/labels";
import { extractPsaCertNumber, lookupPsaCert, lookupPsaPopulation, psaCertUrl } from "@/lib/psa";
import { lookupCardPrice } from "@/lib/tcg-price";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/format";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [asset, user] = await Promise.all([getAssetById(id), getCurrentUser()]);

  if (!asset) notFound();

  // Live PSA cert + population lookup for display — best-effort, and never
  // blocks the page: it silently returns null whenever PSA isn't
  // configured, the account isn't approved for live access yet, or the
  // request fails for any other reason.
  const psaCert = asset.gradingCompany === "PSA" ? await lookupPsaCert(extractPsaCertNumber(asset.serial)) : null;
  const psaPopulation =
    psaCert?.specId != null ? await lookupPsaPopulation(psaCert.specId) : null;

  // Reference raw-card market price — TCG API (TCGPlayer data), Pokemon/TCG
  // only, so this only ever runs for TRADING_CARD. No grade-tier pricing
  // exists in that data at all, so it's deliberately never shown as "the"
  // price for a graded slab — see the disclaimer rendered alongside it.
  const priceQuote = asset.category === "TRADING_CARD" ? await lookupCardPrice(asset.name) : null;

  // Default range matches PriceHistoryChart's own default state (7d) — the
  // client re-fetches on range change, this is just the initial paint.
  const priceHistory = await getPriceHistory(asset.id, "7d");

  const sellerRating = await getSellerRating(asset.seller.id);
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

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ItemGallery
            themeIndex={asset.themeIndex}
            category={asset.category}
            gradingCompany={asset.gradingCompany}
            grade={asset.grade}
            photos={asset.verificationPhotos}
          />
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{CATEGORY_LABELS[asset.category]}</Badge>
                <Badge className={cn("border-0", MARKET_STATUS_BADGE_CLASS[asset.marketStatus])}>
                  {MARKET_STATUS_LABELS[asset.marketStatus]}
                </Badge>
                {asset.vaulted && <Badge variant="secondary">In Platform Vault</Badge>}
                <Badge className={cn("border-0", VERIFICATION_PACKAGE_BADGE_CLASS[asset.verificationPackage])}>
                  {VERIFICATION_PACKAGE_LABELS[asset.verificationPackage]}
                </Badge>
              </div>
              {!isOwner && <WatchButton assetId={asset.id} initialWatching={isWatching} />}
            </div>
            <h1 className="text-2xl font-semibold">{asset.name}</h1>
            <p className="text-muted-foreground text-sm">{asset.subtitle}</p>
          </div>

          {asset.gradingCompany === "RAW" ? (
            <Badge variant="outline" className="w-fit">
              Raw / Ungraded — verified by camera
            </Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {/* Solid-black "seal" — the certification is the single most
                  important credibility signal on this page, so it gets the
                  heaviest visual weight on the page (same weight convention
                  MARKET_STATUS_BADGE_CLASS uses: solid = most important). */}
              <div className="bg-foreground text-background flex items-center gap-3 rounded-xl px-4 py-2.5">
                <div className="flex flex-col items-center leading-none">
                  <span className="text-2xl font-bold tabular-nums">{formatGrade(asset.grade)}</span>
                  <span className="mt-0.5 text-[9px] font-medium tracking-wide uppercase opacity-70">Grade</span>
                </div>
                <div className="bg-background/25 h-8 w-px" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{asset.gradingCompany}</span>
                  <span className="font-mono text-[11px] opacity-80">{asset.serial}</span>
                </div>
              </div>
              {asset.gradingCompany === "PSA" && (
                <a
                  href={psaCertUrl(extractPsaCertNumber(asset.serial))}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
                >
                  View on PSA <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}

          {psaCert && (
            <div className="bg-card rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
                    <ScanSearch className="size-3.5" />
                  </div>
                  <span className="text-sm font-semibold">Card Details</span>
                  <span className="text-muted-foreground text-xs">— Live from PSA</span>
                </div>
                {psaCert.itemStatus && (
                  <Badge variant="outline" className="text-[10px]">
                    {psaCert.itemStatus}
                  </Badge>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {psaCert.year && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Year</dt>
                    <dd className="font-medium">{psaCert.year}</dd>
                  </div>
                )}
                {psaCert.brand && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Brand</dt>
                    <dd className="font-medium">{psaCert.brand}</dd>
                  </div>
                )}
                {psaCert.cardNumber && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Card # (Serial)</dt>
                    <dd className="font-mono font-medium">{psaCert.cardNumber}</dd>
                  </div>
                )}
                {psaCert.variety && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Variety</dt>
                    <dd className="font-medium">{psaCert.variety}</dd>
                  </div>
                )}
                {psaCert.gradeDescription && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Grade Description</dt>
                    <dd className="font-medium">{psaCert.gradeDescription}</dd>
                  </div>
                )}
                {psaCert.totalPopulation != null && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Population at Grade</dt>
                    <dd className="font-medium">{psaCert.totalPopulation.toLocaleString()}</dd>
                  </div>
                )}
                {psaCert.populationHigher != null && (
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
              <p className="text-muted-foreground mt-3 border-t pt-3 text-[11px]">
                Sourced live from PSA&apos;s public Cert Verification API. PSA does not publish a
                price guide through this API, so no market value is shown here — see below for a
                separate reference price source.
              </p>
            </div>
          )}

          {priceQuote && (
            <div className="bg-card rounded-xl border p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
                    <TrendingUp className="size-3.5" />
                  </div>
                  <span className="text-sm font-semibold">Reference Market Price</span>
                  <Badge variant="outline" className="text-[10px]">
                    Ungraded
                  </Badge>
                </div>
                {priceQuote.marketPriceUsd != null && (
                  <span className="text-2xl leading-none font-bold tabular-nums">
                    {formatUsd(priceQuote.marketPriceUsd)}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Matched to &quot;{priceQuote.matchedName}&quot;
                {priceQuote.setName && ` — ${priceQuote.setName}`}
                {priceQuote.cardNumber && ` #${priceQuote.cardNumber}`}
                {priceQuote.printing && ` (${priceQuote.printing})`}
              </p>
            </div>
          )}

          <PriceHistoryChart
            assetId={asset.id}
            initialHistory={priceHistory.map((p) => ({ priceThb: p.priceThb, createdAt: p.createdAt.toISOString() }))}
            currentPriceThb={asset.priceThb}
          />

          <Link
            href={`/store/${asset.seller.id}`}
            className="bg-card hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-3 transition-colors"
          >
            <Avatar className="size-10 shrink-0">
              {asset.seller.image && <AvatarImage src={asset.seller.image} alt={asset.seller.name ?? ""} />}
              <AvatarFallback className="text-sm font-medium">{sellerInitials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Listed by</span>
              <span className="truncate text-sm font-semibold">{asset.seller.name}</span>
              <RatingStars average={sellerRating.average} count={sellerRating.count} />
            </div>
          </Link>
          {asset.owner.id !== asset.seller.id && (
            <p className="text-muted-foreground text-xs">
              Currently owned by{" "}
              <Link href={`/store/${asset.owner.id}`} className="text-foreground font-medium hover:underline">
                {asset.owner.name}
              </Link>
            </p>
          )}

          <Separator />

          <BuyPanel
            assetId={asset.id}
            assetName={asset.name}
            priceThb={asset.priceThb}
            forSale={asset.forSale}
            vaulted={asset.vaulted}
            marketStatus={asset.marketStatus}
            isOwner={isOwner}
          />

          {reviewableEscrow && <LeaveReviewForm escrowTxId={reviewableEscrow.id} />}
        </div>
      </div>

      <Separator className="my-10" />

      <div className="max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
            <History className="size-3.5" />
          </div>
          <h2 className="text-lg font-semibold">Provenance History</h2>
        </div>
        <ProvenanceTimeline events={asset.provenance} />
      </div>
    </div>
  );
}
