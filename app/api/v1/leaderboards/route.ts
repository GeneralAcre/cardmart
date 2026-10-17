import { after, NextResponse, type NextRequest } from "next/server";
import type { LeaderboardCategory, LeaderboardPeriod } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { currentWindow } from "@/lib/leaderboard/periods";
import { runLeaderboardPipeline } from "@/lib/leaderboard/pipeline";

// GET /api/v1/leaderboards?category=roi&timeframe=weekly&page=1
//
//   category   whale | roi (alias alpha) | consistency | market-maker | specialist
//   timeframe  daily | weekly | monthly | all-time            (default weekly)
//   segment    specialist only: game:pokemon, game:one_piece, grader:psa, …
//   page       1-based                                         (default 1)
//   pageSize   1–100                                           (default 25)
//   userId     also return this trader's own row, wherever they rank
//
// Reads the stored snapshot (LeaderboardSnapshot) by rank, so a page costs one
// indexed query. A board older than STALE_MS triggers a rebuild after the
// response is sent; the next request sees fresh ranks.

const CATEGORIES: Record<string, LeaderboardCategory> = {
  whale: "WHALE",
  roi: "ALPHA",
  alpha: "ALPHA",
  consistency: "CONSISTENCY",
  "market-maker": "MARKET_MAKER",
  specialist: "SPECIALIST",
};
const TIMEFRAMES: Record<string, LeaderboardPeriod> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  "all-time": "ALL_TIME",
};
const STALE_MS = 15 * 60_000;

// One rebuild at a time per server instance.
let rebuilding = false;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = CATEGORIES[sp.get("category") ?? ""];
  if (!category) return badRequest(`category must be one of: ${Object.keys(CATEGORIES).join(", ")}`);
  const period = TIMEFRAMES[sp.get("timeframe") ?? "weekly"];
  if (!period) return badRequest(`timeframe must be one of: ${Object.keys(TIMEFRAMES).join(", ")}`);
  const segment = category === "SPECIALIST" ? (sp.get("segment") ?? "").toUpperCase() : "ALL";
  if (category === "SPECIALIST" && !/^(GAME|GRADER):[A-Z_]+$/.test(segment)) {
    return badRequest("specialist boards need a segment such as game:pokemon or grader:psa");
  }
  const page = Math.max(1, Math.floor(Number(sp.get("page") ?? 1)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(sp.get("pageSize") ?? 25)) || 25));
  const userId = sp.get("userId");

  const { periodStart } = currentWindow(period);
  const where = { category, period, periodStart, segment };
  const userSelect = { select: { id: true, name: true, handle: true, image: true } } as const;

  const [rows, total, latest, mine] = await Promise.all([
    prisma.leaderboardSnapshot.findMany({
      where,
      orderBy: { rank: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { rank: true, score: true, metrics: true, user: userSelect },
    }),
    prisma.leaderboardSnapshot.count({ where }),
    prisma.leaderboardSnapshot.findFirst({ where: { period, periodStart }, orderBy: { computedAt: "desc" }, select: { computedAt: true } }),
    userId
      ? prisma.leaderboardSnapshot.findFirst({
          where: { ...where, userId },
          select: { rank: true, score: true, metrics: true, user: userSelect },
        })
      : Promise.resolve(null),
  ]);

  const computedAt = latest?.computedAt ?? null;
  const stale = !computedAt || Date.now() - computedAt.getTime() > STALE_MS;
  if (stale && !rebuilding) {
    rebuilding = true;
    after(async () => {
      try {
        await runLeaderboardPipeline();
      } catch (err) {
        console.error("Leaderboard rebuild failed", err);
      } finally {
        rebuilding = false;
      }
    });
  }

  return NextResponse.json({
    category: sp.get("category"),
    timeframe: sp.get("timeframe") ?? "weekly",
    segment,
    periodStart: periodStart.toISOString(),
    computedAt: computedAt?.toISOString() ?? null,
    stale,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    rows,
    me: mine,
  });
}
