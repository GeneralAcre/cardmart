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
    include: { seller: true, owner: true },
  });
}

export async function getSellerProfile(sellerId: string) {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, name: true, handle: true, image: true, createdAt: true },
  });
  if (!seller) return null;

  const listings = await prisma.asset.findMany({
    where: { sellerId, marketStatus: MARKETPLACE_VISIBLE_STATUSES },
    orderBy: { createdAt: "desc" },
    include: { seller: true, owner: true },
  });

  return { seller, listings };
}

export async function getAssetById(id: string) {
  return prisma.asset.findUnique({
    where: { id },
    include: {
      seller: true,
      owner: true,
      provenance: { orderBy: { createdAt: "asc" }, include: { actor: true } },
      escrowTxs: { orderBy: { createdAt: "desc" } },
      verificationPhotos: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getVaultAssets(userId: string) {
  return prisma.asset.findMany({
    where: {
      ownerId: userId,
      marketStatus: { not: "IN_ESCROW" },
    },
    orderBy: { updatedAt: "desc" },
    include: { seller: true, owner: true },
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
