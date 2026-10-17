import "server-only";

import { prisma } from "@/lib/prisma";
import { displayImage } from "@/lib/card-image";
import { marketCardKey } from "@/lib/market-history";
import { tierKey } from "@/lib/grade-tier";
import { THB_PER_USD } from "@/lib/pricing";

// Profit and loss for a user's cards, from real records only. What they paid
// is their CardMart purchase (a released escrow), or failing that the price
// they entered themselves (PurchaseCost) for a card they listed. What a card
// is worth now is the latest saved market price for that card and grade
// (MarketPriceSnapshot); without one there's no profit figure.

export interface HoldingPnl {
  costThb: number | null;
  // "purchase" = bought on CardMart, "manual" = entered by the owner.
  costSource: "purchase" | "manual" | null;
  valueThb: number | null;
  // eBay's median for this card and grade. Null when there's no market price
  // yet: the owner's own asking price says nothing about profit, so it's not used.
  valueSource: "market" | null;
  gainThb: number | null;
  gainPct: number | null;
}

export interface SoldTrade {
  escrowId: string;
  assetId: string;
  name: string;
  subtitle: string;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  photoUrl: string | null;
  soldThb: number;
  soldAt: string;
  costThb: number | null;
  costSource: "purchase" | "manual" | null;
  gainThb: number | null;
  gainPct: number | null;
}

const gain = (value: number | null, cost: number | null) => {
  if (value == null || cost == null || cost <= 0) return { gainThb: null, gainPct: null };
  return { gainThb: value - cost, gainPct: ((value - cost) / cost) * 100 };
};

type HoldingAsset = {
  id: string;
  name: string;
  subtitle: string;
  cardNumber: string | null;
  language: "ENGLISH" | "JAPANESE" | null;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
};

/** Profit and loss for each card the user holds now, by asset id. */
export async function getHoldingPnl(userId: string, assets: HoldingAsset[]): Promise<Record<string, HoldingPnl>> {
  if (assets.length === 0) return {};
  const ids = assets.map((a) => a.id);
  const cardKeys = [...new Set(assets.map((a) => marketCardKey(a)))];

  const [purchases, manual, snapshots] = await Promise.all([
    prisma.escrowTransaction.findMany({
      where: { buyerId: userId, status: "RELEASED", assetId: { in: ids } },
      orderBy: { releasedAt: "desc" },
      select: { assetId: true, amountThb: true },
    }),
    prisma.purchaseCost.findMany({ where: { userId, assetId: { in: ids } }, select: { assetId: true, costThb: true } }),
    prisma.marketPriceSnapshot.findMany({
      where: { cardKey: { in: cardKeys } },
      orderBy: { day: "desc" },
      select: { cardKey: true, tierKey: true, medianUsd: true },
    }),
  ]);

  // Newest first, so the first row seen per key is the latest.
  const purchaseByAsset = new Map<string, number>();
  for (const p of purchases) if (!purchaseByAsset.has(p.assetId)) purchaseByAsset.set(p.assetId, p.amountThb);
  const manualByAsset = new Map(manual.map((m) => [m.assetId, m.costThb]));
  const marketByKey = new Map<string, number>();
  for (const s of snapshots) {
    const key = `${s.cardKey}#${s.tierKey}`;
    if (!marketByKey.has(key)) marketByKey.set(key, Math.round(s.medianUsd * THB_PER_USD));
  }

  const result: Record<string, HoldingPnl> = {};
  for (const a of assets) {
    const purchase = purchaseByAsset.get(a.id);
    const entered = manualByAsset.get(a.id);
    const costThb = purchase ?? entered ?? null;
    const costSource = purchase != null ? "purchase" : entered != null ? "manual" : null;
    const market = marketByKey.get(`${marketCardKey(a)}#${tierKey(a)}`);
    const valueThb = market ?? null;
    const valueSource = market != null ? "market" : null;
    result[a.id] = { costThb, costSource, valueThb, valueSource, ...gain(valueThb, costThb) };
  }
  return result;
}

/** Every card the user has sold on CardMart, newest first, with what they paid and made. */
export async function getSoldTrades(userId: string): Promise<SoldTrade[]> {
  const sales = await prisma.escrowTransaction.findMany({
    where: { sellerId: userId, status: "RELEASED" },
    orderBy: { releasedAt: "desc" },
    select: {
      id: true,
      amountThb: true,
      releasedAt: true,
      createdAt: true,
      asset: {
        select: {
          id: true,
          name: true,
          subtitle: true,
          gradingCompany: true,
          grade: true,
          isBlackLabel: true,
          catalogImageUrl: true,
          verificationPhotos: { orderBy: { createdAt: "asc" }, select: { url: true } },
        },
      },
    },
  });
  if (sales.length === 0) return [];
  const assetIds = [...new Set(sales.map((s) => s.asset.id))];

  const [purchases, manual] = await Promise.all([
    prisma.escrowTransaction.findMany({
      where: { buyerId: userId, status: "RELEASED", assetId: { in: assetIds } },
      orderBy: { releasedAt: "desc" },
      select: { assetId: true, amountThb: true, releasedAt: true, createdAt: true },
    }),
    prisma.purchaseCost.findMany({ where: { userId, assetId: { in: assetIds } }, select: { assetId: true, costThb: true } }),
  ]);
  const manualByAsset = new Map(manual.map((m) => [m.assetId, m.costThb]));

  return sales.map((sale) => {
    const soldAt = sale.releasedAt ?? sale.createdAt;
    // The user's own purchase of this card just before this sale, if any.
    const purchase = purchases.find(
      (p) => p.assetId === sale.asset.id && (p.releasedAt ?? p.createdAt).getTime() < soldAt.getTime(),
    );
    const entered = manualByAsset.get(sale.asset.id);
    const costThb = purchase?.amountThb ?? entered ?? null;
    return {
      escrowId: sale.id,
      assetId: sale.asset.id,
      name: sale.asset.name,
      subtitle: sale.asset.subtitle,
      gradingCompany: sale.asset.gradingCompany,
      grade: sale.asset.grade,
      isBlackLabel: sale.asset.isBlackLabel,
      photoUrl: displayImage(sale.asset)?.url ?? null,
      soldThb: sale.amountThb,
      soldAt: soldAt.toISOString(),
      costThb,
      costSource: purchase ? "purchase" : entered != null ? "manual" : null,
      ...gain(sale.amountThb, costThb),
    };
  });
}

export interface SaleReceipt extends SoldTrade {
  sellerName: string;
  sellerHandle: string | null;
}

/**
 * One completed sale for its shareable receipt card: what the seller paid
 * (their CardMart purchase, or a price they entered), what it sold for, and
 * the profit. Null unless the sale is completed.
 */
export async function getSaleReceipt(escrowId: string): Promise<SaleReceipt | null> {
  const sale = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    select: {
      id: true,
      status: true,
      amountThb: true,
      releasedAt: true,
      createdAt: true,
      sellerId: true,
      seller: { select: { name: true, handle: true } },
      asset: {
        select: {
          id: true,
          name: true,
          subtitle: true,
          gradingCompany: true,
          grade: true,
          isBlackLabel: true,
          catalogImageUrl: true,
          verificationPhotos: { orderBy: { createdAt: "asc" }, select: { url: true } },
        },
      },
    },
  });
  if (!sale || sale.status !== "RELEASED") return null;
  const soldAt = sale.releasedAt ?? sale.createdAt;

  const [purchase, entered] = await Promise.all([
    prisma.escrowTransaction.findFirst({
      where: { buyerId: sale.sellerId, assetId: sale.asset.id, status: "RELEASED", releasedAt: { lt: soldAt } },
      orderBy: { releasedAt: "desc" },
      select: { amountThb: true },
    }),
    prisma.purchaseCost.findUnique({
      where: { userId_assetId: { userId: sale.sellerId, assetId: sale.asset.id } },
      select: { costThb: true },
    }),
  ]);
  const costThb = purchase?.amountThb ?? entered?.costThb ?? null;

  return {
    escrowId: sale.id,
    assetId: sale.asset.id,
    name: sale.asset.name,
    subtitle: sale.asset.subtitle,
    gradingCompany: sale.asset.gradingCompany,
    grade: sale.asset.grade,
    isBlackLabel: sale.asset.isBlackLabel,
    photoUrl: displayImage(sale.asset)?.url ?? null,
    soldThb: sale.amountThb,
    soldAt: soldAt.toISOString(),
    costThb,
    costSource: purchase ? "purchase" : entered ? "manual" : null,
    ...gain(sale.amountThb, costThb),
    sellerName: sale.seller.name ?? sale.seller.handle ?? "A collector",
    sellerHandle: sale.seller.handle,
  };
}
