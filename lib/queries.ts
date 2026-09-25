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

function withPriceDirection<T extends { priceThb: number | null; priceSnapshots: { priceThb: number }[] }>(asset: T) {
  const previousPrice = asset.priceSnapshots[1]?.priceThb;
  const priceDirection: "up" | "down" | null =
    asset.priceThb == null || previousPrice == null || asset.priceThb === previousPrice
      ? null
      : asset.priceThb > previousPrice
        ? "up"
        : "down";
  const { priceSnapshots: _priceSnapshots, ...summary } = asset;
  void _priceSnapshots;
  return { ...summary, priceDirection };
}

export async function getMarketplaceListings(filters: MarketplaceFilters = {}) {
  // Marketplace is a storefront: only items actually listed for sale, with
  // a price — owned-but-unlisted items belong on Portfolio/store pages.
  const where: Prisma.AssetWhereInput = {
    marketStatus: MARKETPLACE_VISIBLE_STATUSES,
    forSale: true,
    priceThb: { not: null },
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
      not: null,
      ...(filters.priceMin != null ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax != null ? { lte: filters.priceMax } : {}),
    };
  }
  if (filters.vaultedStatus === "IN_VAULT") where.vaulted = true;
  if (filters.vaultedStatus === "SHIPPING") where.vaulted = false;

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      seller: true,
      owner: true,
      verificationPhotos: { orderBy: { createdAt: "asc" } },
      priceSnapshots: { orderBy: { createdAt: "desc" }, take: 2, select: { priceThb: true } },
    },
  });
  return assets.map(withPriceDirection);
}

export type TrendingWindow = 7 | 30;

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
export async function getTrendingListings(limit = 8, lookbackDays: TrendingWindow = 7) {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);

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
        asset: { ...asset, priceDirection: "up" as const }, // only gainers reach this point (gainPct > 0)
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
    select: { id: true, name: true, handle: true, image: true, createdAt: true, walletAddress: true, kycStatus: true },
  });
  if (!seller) return null;

  const [listings, ratingAgg, reviews, soldHistory, saleCount] = await Promise.all([
    prisma.asset.findMany({
      where: { sellerId, marketStatus: MARKETPLACE_VISIBLE_STATUSES },
      orderBy: { createdAt: "desc" },
      include: {
        seller: true,
        owner: true,
        verificationPhotos: { orderBy: { createdAt: "asc" } },
        priceSnapshots: { orderBy: { createdAt: "desc" }, take: 2, select: { priceThb: true } },
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
    prisma.escrowTransaction.count({ where: { sellerId, status: "RELEASED" } }),
  ]);

  return {
    seller,
    listings: listings.map(withPriceDirection),
    rating: { average: ratingAgg._avg.rating, count: ratingAgg._count },
    reviews,
    soldHistory,
    saleCount,
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

/**
 * Other live listings of the *same card* (same name, grading company and
 * grade) from different sellers, for the item page's "Compare Prices"
 * section — this is a same-item, different-seller comparison (who's asking
 * more or less for the identical card), not a "similar items" recommendation
 * across the category. Sorted cheapest-first so under/over-pricing relative
 * to this listing reads at a glance.
 */
export async function getSimilarAssets(
  asset: { id: string; name: string; gradingCompany: GradingCompany; grade: number | null; priceThb: number | null },
  limit = 6,
) {
  const assets = await prisma.asset.findMany({
    where: {
      id: { not: asset.id },
      name: asset.name,
      gradingCompany: asset.gradingCompany,
      grade: asset.grade,
      marketStatus: MARKETPLACE_VISIBLE_STATUSES,
      forSale: true,
      priceThb: { not: null },
    },
    orderBy: { priceThb: "asc" },
    take: limit,
    include: {
      seller: true,
      owner: true,
      verificationPhotos: { orderBy: { createdAt: "asc" } },
      priceSnapshots: { orderBy: { createdAt: "desc" }, take: 2, select: { priceThb: true } },
    },
  });
  return assets.map(withPriceDirection);
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

  const ownedAssetIds = (
    await prisma.asset.findMany({ where: { ownerId: userId, redeemedAt: null }, select: { id: true } })
  ).map(
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
  const assets = await prisma.asset.findMany({
    where: {
      ownerId: userId,
      marketStatus: { not: "IN_ESCROW" },
      // Redeemed items left the vault and their digital twin was burned —
      // they're listed separately, not as tradeable holdings.
      redeemedAt: null,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      seller: true,
      owner: true,
      verificationPhotos: { orderBy: { createdAt: "asc" } },
      priceSnapshots: { orderBy: { createdAt: "desc" }, take: 2, select: { priceThb: true } },
    },
  });
  return assets.map(withPriceDirection);
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
          priceSnapshots: { orderBy: { createdAt: "desc" }, take: 2, select: { priceThb: true } },
        },
      },
    },
  });
  return items.map((i) => withPriceDirection(i.asset));
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

const CONVERSATION_USER_SELECT = { id: true, name: true, handle: true, image: true } as const;

/** The user's inbox — every conversation they're in, most recent first, with the other person and last message. */
export async function getMyConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { lastMessageAt: "desc" },
    include: {
      userA: { select: CONVERSATION_USER_SELECT },
      userB: { select: CONVERSATION_USER_SELECT },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { readAt: null, senderId: { not: userId } } } } },
    },
  });
  return conversations.map((c) => ({
    id: c.id,
    lastMessageAt: c.lastMessageAt,
    otherUser: c.userAId === userId ? c.userB : c.userA,
    lastMessage: c.messages[0] ?? null,
    unreadCount: c._count.messages,
  }));
}

/** One thread, only if the user is a participant — null otherwise, so a guessed id can't read someone else's messages. */
export async function getConversation(conversationId: string, userId: string) {
  const c = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: CONVERSATION_USER_SELECT },
      userB: { select: CONVERSATION_USER_SELECT },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) return null;
  return { id: c.id, otherUser: c.userAId === userId ? c.userB : c.userA, messages: c.messages };
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
    },
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
    where: { status: "ACTIVE", startTime: { lte: new Date() } },
    orderBy: { endTime: "asc" },
    include: {
      asset: { include: { seller: true, owner: true, verificationPhotos: { orderBy: { createdAt: "asc" } } } },
    },
  });
  await Promise.all(auctions.map(settleIfExpiredNoBids));
  // Re-read rather than filter in place — settleIfExpiredNoBids may have
  // just closed some of these out from under us.
  return prisma.auction.findMany({
    where: { status: "ACTIVE", startTime: { lte: new Date() } },
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

// ---------------------------------------------------------------------------
// Market intelligence — every figure below comes from real rows (completed
// escrows, PriceSnapshots, live listings). Nothing is estimated or padded.
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const SALE_LOOKBACK_DAYS = 90;

/**
 * Real CardMart price stats for one exact card (same name + grading company +
 * grade): the median of completed sale prices over the last 90 days — the
 * median, not the mean, so one outlier or wash sale can't drag it — plus the
 * live asking range across every current listing of the same card.
 */
export async function getCardMarketStats(card: { name: string; gradingCompany: GradingCompany; grade: number | null }) {
  const since = new Date(Date.now() - SALE_LOOKBACK_DAYS * 86_400_000);
  const sameCard = { name: card.name, gradingCompany: card.gradingCompany, grade: card.grade };
  const [sales, listings] = await Promise.all([
    prisma.escrowTransaction.findMany({
      where: { status: "RELEASED", releasedAt: { gte: since }, asset: sameCard },
      orderBy: { releasedAt: "desc" },
      select: { amountThb: true, releasedAt: true },
    }),
    prisma.asset.findMany({
      where: { ...sameCard, forSale: true, priceThb: { not: null }, marketStatus: MARKETPLACE_VISIBLE_STATUSES },
      select: { priceThb: true },
    }),
  ]);
  const salePrices = sales.map((s) => s.amountThb);
  const askPrices = listings.map((l) => l.priceThb!);
  return {
    saleCount: sales.length,
    medianSaleThb: median(salePrices),
    lastSaleThb: sales[0]?.amountThb ?? null,
    lastSaleAt: sales[0]?.releasedAt ?? null,
    listingCount: askPrices.length,
    lowestAskThb: askPrices.length ? Math.min(...askPrices) : null,
    highestAskThb: askPrices.length ? Math.max(...askPrices) : null,
    medianAskThb: median(askPrices),
    saleLookbackDays: SALE_LOOKBACK_DAYS,
  };
}

/** Raw inputs for an item's price insights (see lib/insights.ts). */
export async function getAssetInsightData(assetId: string) {
  const [snapshots, watcherCount, pendingOffers] = await Promise.all([
    prisma.priceSnapshot.findMany({
      where: { assetId },
      orderBy: { createdAt: "asc" },
      select: { priceThb: true, createdAt: true },
    }),
    prisma.watchlistItem.count({ where: { assetId } }),
    prisma.offer.count({ where: { assetId, status: "PENDING" } }),
  ]);
  return { snapshots, watcherCount, pendingOffers };
}

export type RankingTier = "black-label" | "grade-10" | "grade-9";

export const RANKING_TIERS: { key: RankingTier; label: string; description: string }[] = [
  { key: "black-label", label: "Black Label", description: "BGS Pristine 10 Black Label — every sub-grade a perfect 10." },
  { key: "grade-10", label: "Grade 10", description: "PSA Gem Mint 10, BGS Pristine / Gem Mint 10 and CGC 10." },
  { key: "grade-9", label: "Grade 9", description: "Mint 9 and Gem Mint 9.5 slabs." },
];

function rankingWhere(tier: RankingTier): Prisma.AssetWhereInput {
  switch (tier) {
    case "black-label":
      return { isBlackLabel: true };
    case "grade-10":
      return { grade: 10, isBlackLabel: false, gradingCompany: { not: "RAW" } };
    case "grade-9":
      return { grade: { gte: 9, lt: 10 }, gradingCompany: { not: "RAW" } };
  }
}

/**
 * Cards in a grade tier ranked by value. Value is the live asking price when
 * listed, otherwise the card's most recent real sale price — cards with
 * neither have no real value to rank by and are left out.
 */
export async function getRankings(tier: RankingTier, limit = 25) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const assets = await prisma.asset.findMany({
    where: { ...rankingWhere(tier), redeemedAt: null },
    include: {
      owner: { select: { id: true, name: true, handle: true, kycStatus: true } },
      verificationPhotos: { orderBy: { createdAt: "asc" }, take: 1 },
      escrowTxs: { where: { status: "RELEASED" }, orderBy: { releasedAt: "desc" }, take: 1, select: { amountThb: true } },
      priceSnapshots: {
        where: { createdAt: { gte: since30 } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { priceThb: true },
      },
      _count: { select: { watchedBy: true } },
    },
  });
  return assets
    .map((a) => {
      const listed = a.forSale && a.priceThb != null && a.marketStatus !== "IN_ESCROW";
      const valueThb = listed ? a.priceThb! : (a.escrowTxs[0]?.amountThb ?? null);
      if (valueThb == null) return null;
      const baseline = a.priceSnapshots[0]?.priceThb ?? null;
      const change30dPct =
        listed && baseline && baseline !== a.priceThb ? ((a.priceThb! - baseline) / baseline) * 100 : null;
      return {
        id: a.id,
        name: a.name,
        subtitle: a.subtitle,
        category: a.category,
        gradingCompany: a.gradingCompany,
        grade: a.grade,
        isBlackLabel: a.isBlackLabel,
        themeIndex: a.themeIndex,
        photoUrl: a.verificationPhotos[0]?.url ?? null,
        owner: a.owner,
        valueThb,
        valueSource: listed ? ("ask" as const) : ("last-sale" as const),
        change30dPct,
        watchers: a._count.watchedBy,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.valueThb - a.valueThb)
    .slice(0, limit);
}

const UPDATE_ASSET_SELECT = {
  id: true,
  name: true,
  gradingCompany: true,
  grade: true,
  isBlackLabel: true,
  redeemedAt: true,
} as const;

export type MarketUpdate = {
  kind: "listed" | "price-up" | "price-down" | "sold";
  at: Date;
  asset: { id: string; name: string; gradingCompany: GradingCompany; grade: number | null; isBlackLabel: boolean };
  priceThb: number;
  previousThb: number | null;
};

/** Market-wide figures plus a feed of the latest real price changes and sales. */
export async function getMarketOverview() {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [listings, sales30d, recentSnapshots, recentSales] = await Promise.all([
    prisma.asset.findMany({
      where: { forSale: true, priceThb: { not: null }, marketStatus: MARKETPLACE_VISIBLE_STATUSES },
      select: { priceThb: true },
    }),
    prisma.escrowTransaction.findMany({
      where: { status: "RELEASED", releasedAt: { gte: since30 } },
      select: { amountThb: true },
    }),
    prisma.priceSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { asset: { select: UPDATE_ASSET_SELECT } },
    }),
    prisma.escrowTransaction.findMany({
      where: { status: "RELEASED", releasedAt: { not: null } },
      orderBy: { releasedAt: "desc" },
      take: 10,
      include: { asset: { select: UPDATE_ASSET_SELECT } },
    }),
  ]);

  // Pair each snapshot with the one before it for the same asset, so the feed
  // can say "up/down from X"; an asset's first-ever snapshot is a new listing.
  const assetIds = [...new Set(recentSnapshots.map((s) => s.assetId))];
  const allSnapshots = await prisma.priceSnapshot.findMany({
    where: { assetId: { in: assetIds } },
    orderBy: { createdAt: "asc" },
    select: { id: true, assetId: true, priceThb: true },
  });
  const lastPriceByAsset = new Map<string, number>();
  const previousBySnapshot = new Map<string, number | null>();
  for (const snap of allSnapshots) {
    previousBySnapshot.set(snap.id, lastPriceByAsset.get(snap.assetId) ?? null);
    lastPriceByAsset.set(snap.assetId, snap.priceThb);
  }

  const updates: MarketUpdate[] = [
    ...recentSnapshots
      .filter((s) => !s.asset.redeemedAt)
      .map((s): MarketUpdate => {
        const prev = previousBySnapshot.get(s.id) ?? null;
        const kind = prev == null || prev === s.priceThb ? "listed" : s.priceThb > prev ? "price-up" : "price-down";
        return { kind, at: s.createdAt, asset: s.asset, priceThb: s.priceThb, previousThb: prev };
      }),
    ...recentSales.map(
      (s): MarketUpdate => ({ kind: "sold", at: s.releasedAt!, asset: s.asset, priceThb: s.amountThb, previousThb: null }),
    ),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15);

  const askPrices = listings.map((l) => l.priceThb!);
  const salePrices = sales30d.map((s) => s.amountThb);
  return {
    activeListings: askPrices.length,
    medianAskThb: median(askPrices),
    sales30d: salePrices.length,
    volume30dThb: salePrices.reduce((a, b) => a + b, 0),
    medianSale30dThb: median(salePrices),
    updates,
  };
}

export async function getMyWantedCards(userId: string) {
  return prisma.wantedCard.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

const TRADE_ASSET_SELECT = {
  id: true,
  name: true,
  subtitle: true,
  gradingCompany: true,
  grade: true,
  isBlackLabel: true,
  themeIndex: true,
  category: true,
  mintAddress: true,
  verificationPhotos: { orderBy: { createdAt: "asc" as const }, take: 1, select: { url: true } },
} as const;

const TRADE_USER_SELECT = { id: true, name: true, handle: true, walletAddress: true } as const;

/** Swaps sent to and by a user, most recent first — BigInt escrow fields left out so this can cross into client components. */
export async function getMyTradeOffers(userId: string) {
  const trades = await prisma.tradeOffer.findMany({
    where: { OR: [{ proposerId: userId }, { recipientId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      cashThb: true,
      message: true,
      status: true,
      createdAt: true,
      proposerId: true,
      recipientId: true,
      proposer: { select: TRADE_USER_SELECT },
      recipient: { select: TRADE_USER_SELECT },
      requestedAsset: { select: TRADE_ASSET_SELECT },
      offeredAsset: { select: TRADE_ASSET_SELECT },
    },
  });
  return {
    received: trades.filter((t) => t.recipientId === userId),
    sent: trades.filter((t) => t.proposerId === userId),
  };
}

/** The viewer's own vaulted cards that could be offered in a swap right now. */
export async function getMySwappableAssets(userId: string) {
  return prisma.asset.findMany({
    where: { ownerId: userId, vaulted: true, redeemedAt: null, marketStatus: { notIn: ["IN_ESCROW", "IN_AUCTION"] } },
    orderBy: { updatedAt: "desc" },
    select: { ...TRADE_ASSET_SELECT, priceThb: true },
  });
}

export async function getMyRedeemedAssets(userId: string) {
  return prisma.asset.findMany({
    where: { ownerId: userId, redeemedAt: { not: null } },
    orderBy: { redeemedAt: "desc" },
    select: { id: true, name: true, gradingCompany: true, grade: true, redeemedAt: true },
  });
}

/** Staff-only: identity submissions awaiting review, plus recently reviewed ones. */
export async function getKycQueue() {
  const select = {
    id: true,
    name: true,
    handle: true,
    email: true,
    phone: true,
    createdAt: true,
    kycStatus: true,
    kycLegalName: true,
    kycDateOfBirth: true,
    kycIdType: true,
    kycIdLast4: true,
    kycSubmittedAt: true,
    kycReviewedAt: true,
    kycRejectReason: true,
  } as const;
  const [pending, reviewed] = await Promise.all([
    prisma.user.findMany({ where: { kycStatus: "PENDING" }, orderBy: { kycSubmittedAt: "asc" }, select }),
    prisma.user.findMany({
      where: { kycStatus: { in: ["VERIFIED", "REJECTED"] } },
      orderBy: { kycReviewedAt: "desc" },
      take: 20,
      select,
    }),
  ]);
  return { pending, reviewed };
}

// ---------------------------------------------------------------------------
// Leaderboard — every live listing with its real price change over 24h / 7d
// / 30d, computed from PriceSnapshots exactly like the item page's insights:
// the baseline is the last snapshot at or before the window start (or the
// first one inside it for a younger listing). A listing with no earlier
// price in the window has no change (null), never a made-up 0%.
// ---------------------------------------------------------------------------

export type LeaderboardPeriod = "24h" | "7d" | "30d";

const LEADERBOARD_PERIOD_DAYS: Record<LeaderboardPeriod, number> = { "24h": 1, "7d": 7, "30d": 30 };

export interface LeaderboardRow {
  id: string;
  name: string;
  subtitle: string;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  isBlackLabel: boolean;
  themeIndex: number;
  photoUrl: string | null;
  vaulted: boolean;
  priceThb: number;
  listedAt: string;
  /** First listed within the last 30 days — the "New drops" tab. */
  isNewDrop: boolean;
  change: Record<LeaderboardPeriod, number | null>;
  sales30d: number;
  watchers: number;
  watchedByViewer: boolean;
}

export async function getLeaderboard(viewerId: string): Promise<LeaderboardRow[]> {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const assets = await prisma.asset.findMany({
    where: {
      forSale: true,
      priceThb: { not: null },
      marketStatus: MARKETPLACE_VISIBLE_STATUSES,
      redeemedAt: null,
    },
    include: {
      verificationPhotos: { orderBy: { createdAt: "asc" }, take: 1, select: { url: true } },
      priceSnapshots: { orderBy: { createdAt: "asc" }, select: { priceThb: true, createdAt: true } },
      watchedBy: { where: { userId: viewerId }, select: { id: true } },
      _count: { select: { watchedBy: true } },
    },
  });

  // Completed sales of the same card (name + company + grade) in the last 30
  // days — the "volume" column, keyed the same way as getCardMarketStats.
  const sales = await prisma.escrowTransaction.findMany({
    where: { status: "RELEASED", releasedAt: { gte: since30 } },
    select: { asset: { select: { name: true, gradingCompany: true, grade: true } } },
  });
  const cardKey = (a: { name: string; gradingCompany: GradingCompany; grade: number | null }) =>
    `${a.name}|${a.gradingCompany}|${a.grade ?? ""}`;
  const salesByCard = new Map<string, number>();
  for (const s of sales) salesByCard.set(cardKey(s.asset), (salesByCard.get(cardKey(s.asset)) ?? 0) + 1);

  const now = Date.now();
  return assets.map((a) => {
    const price = a.priceThb!;
    const change = {} as Record<LeaderboardPeriod, number | null>;
    for (const period of Object.keys(LEADERBOARD_PERIOD_DAYS) as LeaderboardPeriod[]) {
      const since = new Date(now - LEADERBOARD_PERIOD_DAYS[period] * 86_400_000);
      let baseline: number | null = null;
      for (const s of a.priceSnapshots) {
        if (s.createdAt <= since) baseline = s.priceThb;
        else {
          baseline = baseline ?? s.priceThb;
          break;
        }
      }
      change[period] = baseline && baseline !== price ? ((price - baseline) / baseline) * 100 : baseline ? 0 : null;
    }
    return {
      id: a.id,
      name: a.name,
      subtitle: a.subtitle,
      category: a.category,
      gradingCompany: a.gradingCompany,
      grade: a.grade,
      isBlackLabel: a.isBlackLabel,
      themeIndex: a.themeIndex,
      photoUrl: a.verificationPhotos[0]?.url ?? null,
      vaulted: a.vaulted,
      priceThb: price,
      listedAt: (a.priceSnapshots[0]?.createdAt ?? a.createdAt).toISOString(),
      isNewDrop: (a.priceSnapshots[0]?.createdAt ?? a.createdAt) >= since30,
      change,
      sales30d: salesByCard.get(cardKey(a)) ?? 0,
      watchers: a._count.watchedBy,
      watchedByViewer: a.watchedBy.length > 0,
    };
  });
}
