import "server-only";
import type { AssetCategory, GradingCompany, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface MarketplaceFilters {
  q?: string;
  categories?: AssetCategory[];
  gradingCompanies?: GradingCompany[];
  grades?: number[];
  blackLabelOnly?: boolean;
  priceMin?: number;
  priceMax?: number;
  vaultedStatus?: "ALL" | "IN_VAULT" | "SHIPPING";
}

// IN_ESCROW is deliberately excluded — once an item is mid-sale it's not
// actually buyable anymore, so it disappears from browse/store listings
// instead of sitting there with a "Sale Pending" badge that just invites a
// wasted click. It reappears in the seller's own Portfolio and in a
// buyer's Watchlist (both intentionally unfiltered — those views are about
// tracking status, not shopping) once it resolves either way.
const MARKETPLACE_VISIBLE_STATUSES: Prisma.AssetWhereInput["marketStatus"] = {
  in: ["READY_TO_SHIP", "IN_VAULT"],
};

export async function getMarketplaceListings(filters: MarketplaceFilters = {}) {
  const where: Prisma.AssetWhereInput = {
    marketStatus: MARKETPLACE_VISIBLE_STATUSES,
  };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { subtitle: { contains: filters.q, mode: "insensitive" } },
      { serial: { contains: filters.q, mode: "insensitive" } },
      { seller: { name: { contains: filters.q, mode: "insensitive" } } },
      { seller: { handle: { contains: filters.q, mode: "insensitive" } } },
      { owner: { name: { contains: filters.q, mode: "insensitive" } } },
      { owner: { handle: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  if (filters.categories?.length) {
    where.category = { in: filters.categories };
  }
  if (filters.gradingCompanies?.length) {
    where.gradingCompany = { in: filters.gradingCompanies };
  }
  if (filters.grades?.length) {
    where.grade = { in: filters.grades };
  }
  if (filters.blackLabelOnly) {
    where.isBlackLabel = true;
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    where.priceThb = {
      ...(filters.priceMin != null ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax != null ? { lte: filters.priceMax } : {}),
    };
  }
  if (filters.vaultedStatus === "IN_VAULT") where.vaulted = true;
  if (filters.vaultedStatus === "SHIPPING") where.vaulted = false;

  return prisma.asset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      seller: true,
      owner: true,
      verificationPhotos: { orderBy: { createdAt: "asc" } },
    },
  });
}

const TRENDING_LOOKBACK_DAYS = 7;

/**
 * Real "biggest gainers" — compares each for-sale asset's current price
 * against its earliest real PriceSnapshot within the lookback window (or
 * its very first snapshot, if it's younger than that window). Assets with
 * only one snapshot ever (never repriced) have nothing to compare against
 * and are excluded — there's no real trend to report for them, so nothing
 * is fabricated to fill the section. Only genuine increases are returned;
 * if none exist right now, the caller gets an empty array and should just
 * not render the section, rather than show a padded-out or fake list.
 */
export async function getTrendingListings(limit = 8) {
  const since = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 86_400_000);

  const assets = await prisma.asset.findMany({
    where: { forSale: true, marketStatus: { in: ["READY_TO_SHIP", "IN_VAULT"] } },
    include: {
      seller: true,
      owner: true,
      verificationPhotos: { orderBy: { createdAt: "asc" } },
      priceSnapshots: { orderBy: { createdAt: "asc" }, select: { priceThb: true, createdAt: true } },
    },
  });

  return assets
    .map((asset) => {
      const snapshots = asset.priceSnapshots;
      if (snapshots.length < 2) return null;

      const latest = snapshots[snapshots.length - 1];
      // If nothing was actually repriced within the lookback window, this
      // isn't a "this week" trend at all — without this check, the ??
      // fallback below could pair a current price against the asset's very
      // first-ever snapshot from months ago and mislabel that ancient,
      // unrelated gain as recent.
      if (latest.createdAt < since) return null;
      const baseline = snapshots.find((s) => s.createdAt >= since) ?? snapshots[0];
      if (baseline === latest || baseline.priceThb <= 0) return null;

      const gainPct = ((latest.priceThb - baseline.priceThb) / baseline.priceThb) * 100;
      if (gainPct <= 0) return null;

      return {
        asset,
        previousPriceThb: baseline.priceThb,
        currentPriceThb: latest.priceThb,
        gainPct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.gainPct - a.gainPct)
    .slice(0, limit);
}

export async function getSellerProfile(sellerId: string) {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, name: true, handle: true, image: true, createdAt: true, walletAddress: true },
  });
  if (!seller) return null;

  const [listings, ratingAgg, reviews, soldHistory] = await Promise.all([
    prisma.asset.findMany({
      where: { sellerId, marketStatus: MARKETPLACE_VISIBLE_STATUSES },
      orderBy: { createdAt: "desc" },
      include: {
        seller: true,
        owner: true,
        verificationPhotos: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.review.aggregate({ where: { sellerId }, _avg: { rating: true }, _count: true }),
    prisma.review.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { name: true, handle: true } },
        escrowTx: { include: { asset: { select: { name: true } } } },
      },
    }),
    // Real completed sales only — an escrow only reaches RELEASED once the
    // warehouse/vault flow actually finished, never fabricated for display.
    prisma.escrowTransaction.findMany({
      where: { sellerId, status: "RELEASED" },
      orderBy: { releasedAt: "desc" },
      take: 20,
      include: {
        asset: {
          select: { id: true, name: true, category: true, verificationPhotos: { take: 1, orderBy: { createdAt: "asc" } } },
        },
      },
    }),
  ]);

  return {
    seller,
    listings,
    rating: { average: ratingAgg._avg.rating, count: ratingAgg._count },
    reviews,
    soldHistory,
  };
}

export async function getAssetById(id: string) {
  return prisma.asset.findUnique({
    where: { id },
    include: {
      seller: true,
      owner: true,
      provenance: { orderBy: { createdAt: "asc" }, include: { actor: true } },
      escrowTxs: { orderBy: { createdAt: "desc" }, include: { review: true } },
      verificationPhotos: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type PriceHistoryRange = "1d" | "7d" | "30d";

const PRICE_HISTORY_DAYS: Record<PriceHistoryRange, number> = { "1d": 1, "7d": 7, "30d": 30 };

/**
 * Real price-over-time points for an asset, from our own PriceSnapshot
 * table (recorded at list/reprice time — never fabricated or backfilled).
 * A brand-new listing legitimately has just one point; the chart is
 * expected to look flat/sparse until real pricing events accumulate.
 */
export async function getPriceHistory(assetId: string, range: PriceHistoryRange) {
  const since = new Date(Date.now() - PRICE_HISTORY_DAYS[range] * 86_400_000);
  return prisma.priceSnapshot.findMany({
    where: { assetId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Total value of everything a user owns, tracked over time — a real
 * step-function built from the same PriceSnapshot rows the per-item chart
 * uses, merged across every asset they own. At each point where any one
 * asset's price snapshot lands, this recomputes the sum using each asset's
 * latest known price as of that moment. An owned asset with no snapshot at
 * all yet (shouldn't normally happen — every list/reprice writes one) is
 * left out entirely rather than guessed at.
 */
export async function getPortfolioPriceHistory(userId: string, range: PriceHistoryRange) {
  const since = new Date(Date.now() - PRICE_HISTORY_DAYS[range] * 86_400_000);

  const ownedAssetIds = (await prisma.asset.findMany({ where: { ownerId: userId }, select: { id: true } })).map(
    (a) => a.id,
  );
  if (ownedAssetIds.length === 0) return [];

  const [priorSnapshots, snapshotsInRange] = await Promise.all([
    // Last known price per asset from before the window, so the window's
    // first point doesn't undercount assets priced earlier than `since`.
    prisma.priceSnapshot.findMany({
      where: { assetId: { in: ownedAssetIds }, createdAt: { lt: since } },
      orderBy: { createdAt: "desc" },
      distinct: ["assetId"],
    }),
    prisma.priceSnapshot.findMany({
      where: { assetId: { in: ownedAssetIds }, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const latestPriceByAsset = new Map<string, number>();
  for (const s of priorSnapshots) latestPriceByAsset.set(s.assetId, s.priceThb);

  const sumPrices = () => Array.from(latestPriceByAsset.values()).reduce((a, b) => a + b, 0);

  const points: { createdAt: Date; totalThb: number }[] = [];
  if (latestPriceByAsset.size > 0) {
    points.push({ createdAt: since, totalThb: sumPrices() });
  }
  for (const s of snapshotsInRange) {
    latestPriceByAsset.set(s.assetId, s.priceThb);
    points.push({ createdAt: s.createdAt, totalThb: sumPrices() });
  }
  return points;
}

/** Real aggregate rating from completed sales only — never fabricated. */
export async function getSellerRating(sellerId: string) {
  const agg = await prisma.review.aggregate({
    where: { sellerId },
    _avg: { rating: true },
    _count: true,
  });
  return { average: agg._avg.rating, count: agg._count };
}

export async function getVaultAssets(userId: string) {
  return prisma.asset.findMany({
    where: {
      ownerId: userId,
      marketStatus: { not: "IN_ESCROW" },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      seller: true,
      owner: true,
      verificationPhotos: { orderBy: { createdAt: "asc" } },
    },
  });
}

// React's Flight serializer (Server Component -> Client Component props)
// doesn't support raw BigInt — EscrowTransaction.onChainTradeId/lamportsLocked
// are Prisma BigInt columns, and InboundTable/InspectionDialog below are
// "use client" components, so those two fields must be stringified before
// this data crosses that boundary.
function serializeEscrowTx<T extends { onChainTradeId: bigint | null; lamportsLocked: bigint | null }>(
  escrowTx: T,
): Omit<T, "onChainTradeId" | "lamportsLocked"> & { onChainTradeId: string | null; lamportsLocked: string | null } {
  return {
    ...escrowTx,
    onChainTradeId: escrowTx.onChainTradeId?.toString() ?? null,
    lamportsLocked: escrowTx.lamportsLocked?.toString() ?? null,
  };
}

export async function getWarehouseQueue() {
  const packages = await prisma.inboundPackage.findMany({
    where: { status: "PENDING_INSPECTION" },
    orderBy: { arrivedAt: "asc" },
    include: {
      asset: true,
      escrowTx: { include: { buyer: true, seller: true } },
    },
  });
  return packages.map((pkg) => ({ ...pkg, escrowTx: serializeEscrowTx(pkg.escrowTx) }));
}

export async function getGradingSubmissions(userId: string) {
  return prisma.gradingSubmission.findMany({
    where: { sellerId: userId },
    orderBy: { createdAt: "desc" },
    include: { resultAsset: true },
  });
}

export async function getGradingSubmissionQueue() {
  return prisma.gradingSubmission.findMany({
    where: { status: { in: ["AWAITING_SHIPMENT_TO_GRADER", "AT_GRADING_COMPANY"] } },
    orderBy: { createdAt: "asc" },
    include: { seller: true },
  });
}

export async function getGradingSubmissionHistory() {
  return prisma.gradingSubmission.findMany({
    where: { status: { in: ["GRADED", "REJECTED"] } },
    orderBy: { resolvedAt: "desc" },
    take: 20,
    include: { seller: true, resultAsset: true },
  });
}

export async function getWarehouseHistory() {
  const packages = await prisma.inboundPackage.findMany({
    where: { status: { not: "PENDING_INSPECTION" } },
    orderBy: { resolvedAt: "desc" },
    take: 20,
    include: {
      asset: true,
      escrowTx: { include: { buyer: true, seller: true } },
    },
  });
  return packages.map((pkg) => ({ ...pkg, escrowTx: serializeEscrowTx(pkg.escrowTx) }));
}

export async function isAssetWatched(userId: string, assetId: string): Promise<boolean> {
  const existing = await prisma.watchlistItem.findUnique({
    where: { userId_assetId: { userId, assetId } },
  });
  return Boolean(existing);
}

export async function getWatchlist(userId: string) {
  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      asset: {
        include: {
          seller: true,
          owner: true,
          verificationPhotos: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  return items.map((i) => i.asset);
}

// ---------------------------------------------------------------------------
// Notifications — one shared table, two completely separate audiences. The
// "get my ..." functions below are consumer-facing (any signed-in user reads
// their own USER-audience rows); the "getAdmin*" functions are staff-only
// (ADMIN-audience rows, broadcast to every isAdmin user, not tied to one
// userId) — same naming convention as getWarehouseQueue/getGradingSubmissionQueue
// above for "this one's admin-only," gated at the page/action layer via
// requireAdmin(), not by anything in the query itself.
// ---------------------------------------------------------------------------

export async function getMyNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { audience: "USER", userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { audience: "USER", userId, readAt: null },
  });
}

export async function getAdminAlerts(limit = 20) {
  return prisma.notification.findMany({
    where: { audience: "ADMIN" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadAdminAlertCount(): Promise<number> {
  return prisma.notification.count({
    where: { audience: "ADMIN", readAt: null },
  });
}

// ---------------------------------------------------------------------------
// Vault storage mapping — staff-only (see Asset.vaultLocation in
// schema.prisma). Never joined into any buyer/seller-facing query.
// ---------------------------------------------------------------------------

export async function getVaultInventory() {
  return prisma.asset.findMany({
    where: { vaulted: true },
    orderBy: { vaultLocation: "asc" },
    include: {
      owner: { select: { id: true, name: true, handle: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Seller management — staff-only. Real counts (listings, completed sales,
// average rating) pulled from data that already exists elsewhere in the
// app, not a separate fabricated "seller score."
// ---------------------------------------------------------------------------

export async function getSellerManagementList() {
  const users = await prisma.user.findMany({
    where: { profileComplete: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      handle: true,
      email: true,
      createdAt: true,
      isAdmin: true,
      isBanned: true,
      _count: { select: { listedAssets: true, sales: true } },
    },
  });

  const ratings = await prisma.review.groupBy({
    by: ["sellerId"],
    _avg: { rating: true },
    _count: true,
  });
  const ratingBySeller = new Map(ratings.map((r) => [r.sellerId, r]));

  return users.map((u) => ({
    ...u,
    rating: ratingBySeller.get(u.id)?._avg.rating ?? null,
    reviewCount: ratingBySeller.get(u.id)?._count ?? 0,
  }));
}

// No cron job settles an expired auction — it's checked lazily, right here,
// every time an auction is actually read. An expired ACTIVE auction with no
// bids just closes itself out (ENDED_NO_BIDS, asset goes back to its normal
// market status); one with a bid needs its winner to actively claim it (see
// claimAuctionWin in lib/actions.ts), so it's left ACTIVE with endTime in
// the past — getActiveAuctions/getAuctionById below treat that as "ended,
// awaiting claim" without a status change of their own.
async function settleIfExpiredNoBids(auction: { id: string; endTime: Date; status: string; assetId: string }) {
  if (auction.status !== "ACTIVE" || auction.endTime > new Date()) return;
  const bidCount = await prisma.bid.count({ where: { auctionId: auction.id } });
  if (bidCount > 0) return; // has a bid — leave ACTIVE, awaiting the winner's claim
  await prisma.$transaction([
    prisma.auction.update({
      where: { id: auction.id },
      data: { status: "ENDED_NO_BIDS", settledAt: new Date() },
    }),
    prisma.asset.update({
      where: { id: auction.assetId },
      data: { marketStatus: "READY_TO_SHIP" },
    }),
  ]);
}

export async function getActiveAuctions() {
  const auctions = await prisma.auction.findMany({
    where: { status: "ACTIVE" },
    orderBy: { endTime: "asc" },
    include: {
      asset: { include: { seller: true, owner: true, verificationPhotos: { orderBy: { createdAt: "asc" } } } },
    },
  });
  await Promise.all(auctions.map(settleIfExpiredNoBids));
  // Re-read rather than filter in place — settleIfExpiredNoBids may have
  // just closed some of these out from under us.
  return prisma.auction.findMany({
    where: { status: "ACTIVE" },
    orderBy: { endTime: "asc" },
    include: {
      asset: { include: { seller: true, owner: true, verificationPhotos: { orderBy: { createdAt: "asc" } } } },
    },
  });
}

const AUCTION_DETAIL_INCLUDE = {
  asset: { include: { seller: true, owner: true, verificationPhotos: { orderBy: { createdAt: "asc" as const } } } },
  bids: { orderBy: { amountThb: "desc" as const }, include: { bidder: true } },
};

/** Detail-page lookup, keyed by the auction's own id (routed at /auctions/[id]). */
export async function getAuctionById(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: AUCTION_DETAIL_INCLUDE,
  });
  if (!auction) return null;
  await settleIfExpiredNoBids(auction);
  if (auction.status === "ACTIVE") return auction; // still active, or ended-with-a-bid awaiting claim — no status change either way
  return prisma.auction.findUnique({ where: { id: auctionId }, include: AUCTION_DETAIL_INCLUDE });
}

/** Whether this asset currently has a live auction — used to gate the fixed-price buy/offer UI on the item page and Portfolio. */
export async function getActiveAuctionForAsset(assetId: string) {
  const auction = await prisma.auction.findFirst({
    where: { assetId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!auction) return null;
  await settleIfExpiredNoBids(auction);
  return auction.status === "ACTIVE" ? auction : null;
}

/** Pending offers a seller has received across all their listings — for the Portfolio "Offers" tab. */
export async function getOffersReceived(sellerId: string) {
  return prisma.offer.findMany({
    where: { sellerId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { asset: true, buyer: true },
  });
}

/** A buyer's own offers, most recent first — for the Portfolio "Offers" tab. */
export async function getOffersMade(buyerId: string) {
  return prisma.offer.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    include: { asset: true, seller: true },
  });
}

/** Whether the current viewer has a still-actionable accepted offer on this asset — drives the "complete your purchase" banner on the item page. */
export async function getAcceptedOfferForViewer(assetId: string, buyerId: string) {
  return prisma.offer.findFirst({
    where: { assetId, buyerId, status: "ACCEPTED" },
  });
}
