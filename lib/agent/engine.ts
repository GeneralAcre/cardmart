import "server-only";
// Runs buying mandates against listings: hard filters in code first (price,
// budget, grade, grader, game, seller trust), then Claude judges what's left
// (lib/agent/ai.ts), then each recommended buy is either executed or proposed
// to the user. The actual purchase is passed in as `execute` — it lives with
// the rest of the escrow code in lib/actions.ts.
import type { AgentMandate, GradingCompany, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { judgeListings, isAgentAiConfigured, type CandidateListing } from "@/lib/agent/ai";
import { isEbayConfigured, lookupEbayPrice } from "@/lib/ebay";
import { THB_PER_USD } from "@/lib/pricing";

export type ExecuteAgentDecision = (decisionId: string) => Promise<void>;
export type NotifyAgentOwner = (
  userId: string,
  type: "AGENT_PROPOSAL",
  title: string,
  body: string,
  href: string,
) => Promise<void>;

// Keeps one Claude call small and fast; the newest listings go first.
const MAX_CANDIDATES_PER_RUN = 12;
const SALE_LOOKBACK_DAYS = 90;

/** Words from the mandate's query worth matching on, e.g. "charizard", "151". */
function queryTerms(query: string): string[] {
  const stop = new Set(["the", "and", "card", "cards", "pokemon", "pokémon", "one", "piece", "psa", "bgs", "cgc"]);
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u))].filter((w) => w.length >= 3 && !stop.has(w));
}

function listingFilter(mandate: AgentMandate): Prisma.AssetWhereInput {
  const remaining = mandate.budgetThb - mandate.spentThb;
  const terms = queryTerms(mandate.query);
  return {
    forSale: true,
    redeemedAt: null,
    marketStatus: { in: ["READY_TO_SHIP", "IN_VAULT"] },
    ownerId: { not: mandate.userId },
    priceThb: { not: null, lte: Math.min(mandate.maxPriceThb, remaining) },
    ...(mandate.game ? { game: mandate.game } : {}),
    ...(mandate.gradingCompanies.length ? { gradingCompany: { in: mandate.gradingCompanies } } : {}),
    ...(mandate.minGrade != null ? { grade: { gte: mandate.minGrade } } : {}),
    ...(mandate.blackLabelOnly ? { isBlackLabel: true } : {}),
    ...(terms.length ? { OR: terms.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) } : {}),
  };
}

async function sellerTrust(sellerIds: string[]) {
  const [ratings, users, sales] = await Promise.all([
    prisma.review.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds } }, _avg: { rating: true }, _count: true }),
    prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, kycStatus: true } }),
    prisma.escrowTransaction.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds }, status: "RELEASED" }, _count: true }),
  ]);
  return new Map(
    sellerIds.map((id) => {
      const r = ratings.find((x) => x.sellerId === id);
      return [
        id,
        {
          rating: r?._avg.rating ?? null,
          reviewCount: r?._count ?? 0,
          idVerified: users.find((u) => u.id === id)?.kycStatus === "VERIFIED",
          completedSales: sales.find((s) => s.sellerId === id)?._count ?? 0,
        },
      ];
    }),
  );
}

/** Same rule as "trusted seller" card alerts: verified identity, or a 4-star average from real reviews. */
function isTrusted(t: { rating: number | null; idVerified: boolean }) {
  return t.idVerified || (t.rating != null && t.rating >= 4);
}

async function marketData(card: { name: string; gradingCompany: GradingCompany; grade: number | null; id: string }) {
  const since = new Date(Date.now() - SALE_LOOKBACK_DAYS * 86_400_000);
  const same = { name: card.name, gradingCompany: card.gradingCompany, grade: card.grade };
  const [sales, others, ebay] = await Promise.all([
    prisma.escrowTransaction.findMany({
      where: { status: "RELEASED", releasedAt: { gte: since }, asset: same },
      select: { amountThb: true },
    }),
    prisma.asset.findFirst({
      where: { ...same, id: { not: card.id }, forSale: true, priceThb: { not: null } },
      orderBy: { priceThb: "asc" },
      select: { priceThb: true },
    }),
    isEbayConfigured() ? lookupEbayPrice(card.name, card.gradingCompany, card.grade).catch(() => null) : null,
  ]);
  const prices = sales.map((s) => s.amountThb).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor((prices.length - 1) / 2)] : null;
  return {
    cardMartMedianSaleThb: median,
    cardMartSalesCount: prices.length,
    lowestOtherListingThb: others?.priceThb ?? null,
    ebayMedianAskingThb: ebay ? Math.round(ebay.medianPriceUsd * THB_PER_USD) : null,
  };
}

/**
 * Evaluates listings for one mandate — every current match, or just `assetId`
 * when a new listing triggered it. Each listing/price pair is judged at most
 * once per mandate. Returns how many decisions were recorded.
 */
export async function runMandate(
  mandateId: string,
  opts: { assetId?: string; execute: ExecuteAgentDecision; notify: NotifyAgentOwner },
): Promise<number> {
  if (!isAgentAiConfigured()) return 0;
  const mandate = await prisma.agentMandate.findUnique({ where: { id: mandateId } });
  if (!mandate || mandate.status !== "ACTIVE" || mandate.boughtCount >= mandate.maxCards) return 0;

  const decided = await prisma.agentDecision.findMany({
    where: { mandateId },
    select: { assetId: true, priceThb: true },
  });
  const seen = new Set(decided.map((d) => `${d.assetId}:${d.priceThb}`));

  const listings = (
    await prisma.asset.findMany({
      where: { ...listingFilter(mandate), ...(opts.assetId ? { id: opts.assetId } : {}) },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES_PER_RUN * 2,
    })
  ).filter((a) => !seen.has(`${a.id}:${a.priceThb}`));

  const trust = await sellerTrust([...new Set(listings.map((a) => a.ownerId))]);
  const eligible = listings
    .filter((a) => !mandate.trustedSellersOnly || isTrusted(trust.get(a.ownerId)!))
    .slice(0, MAX_CANDIDATES_PER_RUN);

  await prisma.agentMandate.update({ where: { id: mandateId }, data: { lastScannedAt: new Date() } });
  if (eligible.length === 0) return 0;

  const candidates: CandidateListing[] = await Promise.all(
    eligible.map(async (a) => ({
      assetId: a.id,
      name: a.name,
      subtitle: a.subtitle,
      gradingCompany: a.gradingCompany,
      grade: a.grade,
      isBlackLabel: a.isBlackLabel,
      priceThb: a.priceThb!,
      vaulted: a.vaulted,
      seller: trust.get(a.ownerId)!,
      market: await marketData(a),
    })),
  );

  const judgements = await judgeListings(mandate, candidates);
  let recorded = 0;
  // Cheapest recommended buy first, so a small budget goes furthest.
  const ordered = [...judgements].sort(
    (a, b) =>
      Number(b.isMatch && b.buy) - Number(a.isMatch && a.buy) ||
      candidates.find((c) => c.assetId === a.assetId)!.priceThb - candidates.find((c) => c.assetId === b.assetId)!.priceThb,
  );

  for (const j of ordered) {
    const listing = candidates.find((c) => c.assetId === j.assetId)!;
    const recommend = j.isMatch && j.buy;
    let decision;
    try {
      decision = await prisma.agentDecision.create({
        data: {
          mandateId,
          assetId: j.assetId,
          priceThb: listing.priceThb,
          status: recommend ? "PROPOSED" : "SKIPPED",
          fairValueThb: j.fairValueThb,
          confidence: j.confidence,
          reasoning: j.reasoning,
        },
      });
    } catch {
      continue; // Another run already judged this listing at this price.
    }
    recorded++;
    if (!recommend) continue;

    if (mandate.autoBuy) {
      await opts.execute(decision.id);
    } else {
      await opts.notify(
        mandate.userId,
        "AGENT_PROPOSAL",
        "Your agent found a card",
        `${listing.name} for ${listing.priceThb.toLocaleString()} THB. ${j.reasoning} Approve it to buy.`,
        "/agent",
      );
    }
  }
  return recorded;
}

/** Runs every active mandate that could want this newly listed (or repriced) card. */
export async function runMandatesForListing(
  assetId: string,
  opts: { execute: ExecuteAgentDecision; notify: NotifyAgentOwner },
): Promise<void> {
  if (!isAgentAiConfigured()) return;
  const mandates = await prisma.agentMandate.findMany({ where: { status: "ACTIVE" } });
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) return;
  for (const mandate of mandates) {
    const matches = await prisma.asset.count({ where: { ...listingFilter(mandate), id: assetId } });
    if (matches === 0) continue;
    try {
      await runMandate(mandate.id, { ...opts, assetId });
    } catch (err) {
      console.error(`Agent mandate ${mandate.id} failed on listing ${assetId}`, err);
    }
  }
}
