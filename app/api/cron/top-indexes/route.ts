import { NextResponse, type NextRequest } from "next/server";

import { refreshTopIndexes } from "@/lib/top-index";

// Daily Vercel Cron (see vercel.json), after TCGplayer's prices are copied to
// tcgcsv.com (~20:00 UTC): re-ranks the 50 most valuable Pokémon and One
// Piece cards and saves today's prices, which is what the game indexes are
// built from. Vercel sends CRON_SECRET as a bearer token; without that env
// var set, the endpoint refuses every call.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ saved: await refreshTopIndexes() });
}
