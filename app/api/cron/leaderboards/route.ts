import { NextResponse, type NextRequest } from "next/server";

import { runLeaderboardPipeline } from "@/lib/leaderboard/pipeline";

// Daily Vercel Cron (see vercel.json): rebuilds every trader leaderboard and
// awards badges for the week or month that just closed. Boards also refresh
// on demand when the API sees one older than 15 minutes. Vercel sends
// CRON_SECRET as a bearer token; without it set, every call is refused.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runLeaderboardPipeline();
  return NextResponse.json(result);
}
