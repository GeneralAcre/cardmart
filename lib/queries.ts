import "server-only";
import type { AssetCategory, GradingCompany, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface MarketplaceFilters {
  q?: string;
  categories?: AssetCategory[];
  gradingCompanies?: GradingCompany[];
  grades?: number[];
  priceMin?: number;
  priceMax?: number;
  vaultedStatus?: "ALL" | "IN_VAULT" | "SHIPPING";
}

const MARKETPLACE_VISIBLE_STATUSES: Prisma.AssetWhereInput["marketStatus"] = {
  in: ["READY_TO_SHIP", "IN_VAULT", "IN_ESCROW"],
};

export async function getMarketplaceListings(filters: MarketplaceFilters = {}) {
  const where: Prisma.AssetWhereInput = {
    marketStatus: MARKETPLACE_VISIBLE_STATUSES,
  };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { subtitle: { contains: filters.q } },
      { serial: { contains: filters.q } },
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

export async function getSellerProfile(sellerId: string) {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, name: true, handle: true, image: true, createdAt: true, walletAddress: true },
  });
  if (!seller) return null;

  const [listings, ratingAgg, reviews] = await Promise.all([
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
  ]);

  return {
    seller,
    listings,
    rating: { average: ratingAgg._avg.rating, count: ratingAgg._count },
    reviews,
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

export async function getWarehouseQueue() {
  return prisma.inboundPackage.findMany({
    where: { status: "PENDING_INSPECTION" },
    orderBy: { arrivedAt: "asc" },
    include: {
      asset: true,
      escrowTx: { include: { buyer: true, seller: true } },
    },
  });
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
  return prisma.inboundPackage.findMany({
    where: { status: { not: "PENDING_INSPECTION" } },
    orderBy: { resolvedAt: "desc" },
    take: 20,
    include: {
      asset: true,
      escrowTx: { include: { buyer: true, seller: true } },
    },
  });
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
