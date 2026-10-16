import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { snapshotMarketPrices } from "@/lib/market-history";

// Daily Vercel Cron (see vercel.json) — saves today's eBay market price for
// every card on CardMart that hasn't been redeemed, in its own grade, so the
// item page's history, the CardMart indexes and portfolio values keep
// growing even on days nobody opens a card. Cards for sale go first, and one
// run prices at most MAX_CARDS distinct card-and-grade pairs to stay inside
// eBay's 5,000 calls a day and this function's time limit. Vercel sends
// CRON_SECRET as a bearer token; without that env var set, the endpoint
// refuses every call.
export const maxDuration = 300;

const MAX_CARDS = 400;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const assets = await prisma.asset.findMany({
    where: { redeemedAt: null },
    orderBy: [{ forSale: "desc" }, { updatedAt: "desc" }],
    select: { name: true, subtitle: true, cardNumber: true, language: true, gradingCompany: true, grade: true, isBlackLabel: true },
  });
  const saved = await snapshotMarketPrices(assets, MAX_CARDS);
  return NextResponse.json({ cards: assets.length, saved });
}
