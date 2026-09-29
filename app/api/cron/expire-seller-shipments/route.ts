import { NextResponse, type NextRequest } from "next/server";

import { expireOverdueSellerShipments } from "@/lib/actions";

// Daily Vercel Cron (see vercel.json) — cancels and refunds sales whose
// seller missed the shipping deadline even if nobody opens a page that would
// otherwise catch them. Vercel sends CRON_SECRET as a bearer token; without
// that env var set, the endpoint refuses every call.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireOverdueSellerShipments();
  return NextResponse.json({ expired });
}
