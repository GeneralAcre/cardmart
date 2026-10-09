import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { snapshotMarketPrices } from "@/lib/market-history";

// Daily Vercel Cron (see vercel.json) — saves today's eBay market price for
// every card currently for sale, in its own grade, so the item page's
// market history keeps growing even on days nobody opens it. Vercel sends
// CRON_SECRET as a bearer token; without that env var set, the endpoint
// refuses every call.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const assets = await prisma.asset.findMany({
    where: { forSale: true, redeemedAt: null },
    select: { name: true, subtitle: true, cardNumber: true, language: true, gradingCompany: true, grade: true, isBlackLabel: true },
  });
  const saved = await snapshotMarketPrices(assets);
  return NextResponse.json({ cards: assets.length, saved });
}
