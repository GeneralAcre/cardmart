import "server-only";
// Runs buying mandates against listings: hard filters in code first (price,
// budget, grade, grader, game, seller trust), then the AI judges what's left
// (lib/agent/ai.ts), then each recommended buy is either executed or proposed
// to the user. The actual purchase is passed in as `execute` — it lives with
// the rest of the escrow code in lib/actions.ts.
import type { AgentMandate, GradingCompany, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { judgeListings, isAgentAiConfigured, type CandidateListing } from "@/lib/agent/ai";
import { isEbayConfigured, lookupEbayPrice } from "@/lib/ebay";
import { AGENT_TASK_MAX_REVIEWS, THB_PER_USD } from "@/lib/pricing";

export type ExecuteAgentDecision = (decisionId: string) => Promise<void>;
export type SendAgentOffer = (decisionId: string) => Promise<void>;
export type NotifyAgentOwner = (
  userId: string,
  type: "AGENT_PROPOSAL" | "AGENT_FAILED",
  title: string,
  body: string,
  href: string,
) => Promise<void>;

// Keeps one AI call small and fast; the newest listings go first.
const MAX_CANDIDATES_PER_RUN = 12;
const SALE_LOOKBACK_DAYS = 90;
// With offers on, listings up to this much over the task's limit are judged
// too — the agent offers at most the limit, so it never pays more.
const OFFER_STRETCH = 1.25;

/** The most the task can pay for one card right now. */
function buyLimit(mandate: AgentMandate): number {
  return Math.min(mandate.maxPriceThb, mandate.budgetThb - mandate.spentThb);
}

/** Words from the mandate's query worth matching on, e.g. "charizard", "151". */
function queryTerms(query: string): string[] {
  const stop = new Set(["the", "and", "card", "cards", "pokemon", "pokémon", "one", "piece", "psa", "bgs", "cgc"]);
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u))].filter((w) => w.length >= 3 && !stop.has(w));
}

function listingFilter(mandate: AgentMandate): Prisma.AssetWhereInput {
  const limit = buyLimit(mandate);
  const terms = queryTerms(mandate.query);
  return {
    forSale: true,
    redeemedAt: null,
    marketStatus: { in: ["READY_TO_SHIP", "IN_VAULT"] },
    ownerId: { not: mandate.userId },
    priceThb: { not: null, lte: mandate.makeOffers ? Math.floor(limit * OFFER_STRETCH) : limit },
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
  opts: { assetId?: string; execute: ExecuteAgentDecision; notify: NotifyAgentOwner; offer: SendAgentOffer },
): Promise<number> {
  if (!isAgentAiConfigured()) return 0;
  const mandate = await prisma.agentMandate.findUnique({ where: { id: mandateId } });
  if (!mandate || mandate.status !== "ACTIVE" || mandate.boughtCount >= mandate.maxCards) return 0;

  const decided = await prisma.agentDecision.findMany({
    where: { mandateId },
    select: { assetId: true, priceThb: true },
  });
  // The task fee covers this many AI reviews; after that the task finishes.
  if (decided.length >= AGENT_TASK_MAX_REVIEWS) {
    await prisma.agentMandate.update({ where: { id: mandateId }, data: { status: "DONE" } });
    await opts.notify(
      mandate.userId,
      "AGENT_FAILED",
      "Your agent task finished",
      `It reviewed ${AGENT_TASK_MAX_REVIEWS} listings, the most one task covers. Start a new task to keep looking.`,
      "/agent",
    );
    return 0;
  }
  const seen = new Set(decided.map((d) => `${d.assetId}:${d.priceThb}`));

  const listings = (
    await prisma.asset.findMany({
      where: { ...listingFilter(mandate), ...(opts.assetId ? { id: opts.assetId } : {}) },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES_PER_RUN * 2,
    })
  ).filter((a) => !seen.has(`${a.id}:${a.priceThb}`));
  // A listing the user already has an offer out on is waiting on its seller.
  const pendingOffers = await prisma.offer.findMany({
    where: { buyerId: mandate.userId, status: "PENDING", assetId: { in: listings.map((a) => a.id) } },
    select: { assetId: true },
  });
  const offeredOn = new Set(pendingOffers.map((o) => o.assetId));

  const trust = await sellerTrust([...new Set(listings.map((a) => a.ownerId))]);
  const eligible = listings
    .filter((a) => !offeredOn.has(a.id) && (!mandate.trustedSellersOnly || isTrusted(trust.get(a.ownerId)!)))
    .slice(0, MAX_CANDIDATES_PER_RUN);

  await prisma.agentMandate.update({ where: { id: mandateId }, data: { lastScannedAt: new Date() } });
  if (eligible.length === 0) return 0;

  const limit = buyLimit(mandate);
  const candidates: CandidateListing[] = await Promise.all(
    eligible.map(async (a) => ({
      assetId: a.id,
      name: a.name,
      subtitle: a.subtitle,
      gradingCompany: a.gradingCompany,
      grade: a.grade,
      isBlackLabel: a.isBlackLabel,
      priceThb: a.priceThb!,
      askingAboveMax: a.priceThb! > limit,
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
    // Over the limit: offer the limit, or the fair value if that's lower,
    // rounded down to the nearest 100 THB.
    const overLimit = listing.priceThb > limit;
    const offerThb = recommend && overLimit ? Math.floor(Math.min(limit, j.fairValueThb ?? limit) / 100) * 100 : null;
    const status = !recommend ? "SKIPPED" : !overLimit ? "PROPOSED" : offerThb && offerThb >= 100 ? "OFFERED" : "SKIPPED";
    let decision;
    try {
      decision = await prisma.agentDecision.create({
        data: {
          mandateId,
          assetId: j.assetId,
          priceThb: listing.priceThb,
          status,
          offerThb: status === "OFFERED" ? offerThb : null,
          fairValueThb: j.fairValueThb,
          confidence: j.confidence,
          reasoning: j.reasoning,
        },
      });
    } catch {
      continue; // Another run already judged this listing at this price.
    }
    recorded++;
    if (status === "OFFERED") {
      await opts.offer(decision.id);
      continue;
    }
    if (status !== "PROPOSED") continue;

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
  opts: { execute: ExecuteAgentDecision; notify: NotifyAgentOwner; offer: SendAgentOffer },
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

/** Withdraws a task's offers that are still waiting on sellers (the task was paused, stopped or finished). */
export async function withdrawAgentOffers(mandateId: string): Promise<void> {
  const open = await prisma.agentDecision.findMany({
    where: { mandateId, status: "OFFERED" },
    select: { id: true, offerId: true },
  });
  if (open.length === 0) return;
  const offerIds = open.map((d) => d.offerId).filter((id): id is string => id != null);
  await prisma.$transaction([
    prisma.offer.updateMany({
      where: { id: { in: offerIds }, status: "PENDING" },
      data: { status: "WITHDRAWN", respondedAt: new Date() },
    }),
    prisma.agentDecision.updateMany({
      where: { id: { in: open.map((d) => d.id) }, status: "OFFERED" },
      data: { status: "DECLINED", error: "Offer withdrawn because the task stopped.", resolvedAt: new Date() },
    }),
  ]);
}
