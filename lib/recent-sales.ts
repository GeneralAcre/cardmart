import "server-only";

import { prisma } from "@/lib/prisma";
import { WAREHOUSE_FIRST, displayImage } from "@/lib/card-image";
import { marketCardKey } from "@/lib/market-history";
import { tierKey } from "@/lib/grade-tier";
import { THB_PER_USD } from "@/lib/pricing";

// The "Just sold" ticker on the Market page: the latest real CardMart sales
// (escrows that reached RELEASED), each compared with the latest saved market
// price for that card and grade (MarketPriceSnapshot), the same figure the
// portfolio uses for a card's value. No market price, no comparison.

export interface RecentSale {
  id: string;
  assetId: string;
  name: string;
  cardNumber: string | null;
  imageUrl: string | null;
  priceThb: number;
  soldAt: string;
  /** Sale price against the market price, in percent: -16 is 16% under. */
  vsMarketPct: number | null;
}

export async function getRecentSales(limit = 20): Promise<RecentSale[]> {
  const sales = await prisma.escrowTransaction.findMany({
    where: { status: "RELEASED", releasedAt: { not: null } },
    orderBy: { releasedAt: "desc" },
    take: limit,
    select: {
      id: true,
      amountThb: true,
      releasedAt: true,
      asset: {
        select: {
          id: true,
          name: true,
          subtitle: true,
          cardNumber: true,
          language: true,
          gradingCompany: true,
          grade: true,
          isBlackLabel: true,
          catalogImageUrl: true,
          verificationPhotos: { orderBy: WAREHOUSE_FIRST },
        },
      },
    },
  });
  if (sales.length === 0) return [];

  const snapshots = await prisma.marketPriceSnapshot.findMany({
    where: { cardKey: { in: [...new Set(sales.map((s) => marketCardKey(s.asset)))] } },
    orderBy: { day: "desc" },
    select: { cardKey: true, tierKey: true, medianUsd: true },
  });
  // Newest first, so the first row seen per key is the latest.
  const marketByKey = new Map<string, number>();
  for (const s of snapshots) {
    const key = `${s.cardKey}#${s.tierKey}`;
    if (!marketByKey.has(key)) marketByKey.set(key, s.medianUsd * THB_PER_USD);
  }

  return sales.map((s) => {
    const market = marketByKey.get(`${marketCardKey(s.asset)}#${tierKey(s.asset)}`);
    return {
      id: s.id,
      assetId: s.asset.id,
      name: s.asset.name,
      cardNumber: s.asset.cardNumber,
      imageUrl: displayImage(s.asset)?.url ?? null,
      priceThb: s.amountThb,
      soldAt: s.releasedAt!.toISOString(),
      vsMarketPct: market ? Math.round(((s.amountThb - market) / market) * 100) : null,
    };
  });
}
