"use server";

// Buying agent: the chat, setting up tasks and managing the agent wallet. Scanning and
// buying live in lib/actions.ts (they reuse the escrow purchase code).
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getLocale } from "@/lib/i18n/server";
import { isAgentAiConfigured } from "@/lib/agent/ai";
import { runChatTurn, SALE_LOOKBACK_DAYS, type ChatTurn, type MarketSnapshot } from "@/lib/agent/chat";
import { withdrawAgentOffers } from "@/lib/agent/engine";
import { GRADERS, type TaskDraft } from "@/lib/agent/task";
import {
  getAgentBalanceLamports,
  getOrCreateAgentWallet,
  isAgentChainEnabled,
  lamportsToSol,
  payAgentTaskFee,
  withdrawAgentBalance,
} from "@/lib/agent/wallet";
import { getMarketplaceListings, getMyWantedCards, median } from "@/lib/queries";
import { displayImage } from "@/lib/card-image";
import {
  AGENT_CHAT_MESSAGES_PER_DAY,
  AGENT_TASK_FEE_THB,
  BUYER_FEE_PERCENT,
  SELF_MINT_FEE_THB,
  SELLER_SHIPPING_COST_THB,
  THB_PER_SOL,
  thbToLamports,
} from "@/lib/pricing";
import { requestDevnetAirdrop } from "@/lib/solana";

export type { MarketSnapshot };

async function marketSnapshot(d: TaskDraft): Promise<MarketSnapshot | null> {
  const q = d.query.trim();
  if (q.length < 2) return null;
  const graders = d.gradingCompanies.length ? d.gradingCompanies : undefined;
  const meetsGrade = (grade: number | null, company: string) =>
    d.minGrade == null || company === "RAW" || (grade != null && grade >= d.minGrade);
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);

  const [listings, sales] = await Promise.all([
    getMarketplaceListings({
      q,
      games: d.game ? [d.game] : undefined,
      gradingCompanies: graders,
      blackLabelOnly: d.blackLabelOnly,
    }),
    prisma.escrowTransaction.findMany({
      where: {
        status: "RELEASED",
        releasedAt: { gte: new Date(Date.now() - SALE_LOOKBACK_DAYS * 86_400_000) },
        asset: {
          // Every word has to match, like the market search.
          AND: words.map((w) => ({
            OR: [
              { name: { contains: w, mode: "insensitive" as const } },
              { subtitle: { contains: w, mode: "insensitive" as const } },
              { cardNumber: { contains: w, mode: "insensitive" as const } },
            ],
          })),
          ...(d.game ? { game: d.game } : {}),
          ...(graders ? { gradingCompany: { in: graders } } : {}),
          ...(d.blackLabelOnly ? { isBlackLabel: true } : {}),
        },
      },
      select: { amountThb: true, asset: { select: { grade: true, gradingCompany: true } } },
      take: 200,
    }),
  ]);
  const matching = listings
    .filter((l) => meetsGrade(l.grade, l.gradingCompany))
    .sort((a, b) => a.priceThb! - b.priceThb!);
  const salePrices = sales.filter((s) => meetsGrade(s.asset.grade, s.asset.gradingCompany)).map((s) => s.amountThb);
  return {
    query: q,
    forSale: matching.length,
    lowestThb: matching[0]?.priceThb ?? null,
    medianAskThb: median(matching.map((l) => l.priceThb!)),
    recentSales: salePrices.length,
    medianSaleThb: median(salePrices),
    cheapest: matching.slice(0, 3).map((l) => ({
      id: l.id,
      name: l.name,
      subtitle: l.subtitle,
      gradingCompany: l.gradingCompany,
      grade: l.grade,
      isBlackLabel: l.isBlackLabel,
      priceThb: l.priceThb!,
      imageUrl: displayImage(l)?.url ?? null,
    })),
  };
}

const chatSchema = z.object({
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1200) }))
    .min(1)
    .max(40),
  draft: z
    .object({
      query: z.string().max(120),
      game: z.enum(["POKEMON", "ONE_PIECE"]).nullable(),
      gradingCompanies: z.array(z.enum(GRADERS)).max(4),
      minGrade: z.number().nullable(),
      blackLabelOnly: z.boolean(),
      maxPriceThb: z.number(),
      maxCards: z.number(),
      budgetThb: z.number().nullable(),
      trustedSellersOnly: z.boolean(),
      autoBuy: z.boolean(),
      makeOffers: z.boolean(),
      fulfillment: z.enum(["VAULT", "SHIP"]),
      notes: z.string().max(300),
    })
    .nullable(),
});

export type AgentChatResult = Partial<ChatTurn> & { error?: string };

/** One turn of the agent chat: the conversation so far in, the agent's reply and updated task draft out. */
export async function agentChat(input: z.input<typeof chatSchema>): Promise<AgentChatResult> {
  const user = await getCurrentUser();
  const parsed = chatSchema.safeParse(input);
  if (!parsed.success) return { error: "Keep messages under 1,200 characters." };
  const { history, draft } = parsed.data;
  if (history.at(-1)?.role !== "user") return { error: "Say something to the agent first." };
  if (!isAgentAiConfigured()) return { error: "The buying agent isn't switched on yet (OPENROUTER_API_KEY is missing)." };

  const today = await prisma.agentPlanRequest.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (today >= AGENT_CHAT_MESSAGES_PER_DAY) return { error: "You've chatted with the agent a lot today. Try again tomorrow." };
  await prisma.agentPlanRequest.create({ data: { userId: user.id } });

  const [tasks, decisions, alerts, wallet, market, locale] = await Promise.all([
    prisma.agentMandate.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } },
      select: {
        summary: true,
        status: true,
        boughtCount: true,
        _count: { select: { decisions: { where: { status: "PROPOSED" } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.agentDecision.findMany({
      where: { mandate: { userId: user.id }, status: { not: "SKIPPED" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { status: true, priceThb: true, offerThb: true, asset: { select: { name: true, gradingCompany: true, grade: true } } },
    }),
    getMyWantedCards(user.id),
    getOrCreateAgentWallet(user.id),
    draft ? marketSnapshot(draft).catch(() => null) : null,
    getLocale(),
  ]);
  const balanceSol = wallet ? await getAgentBalanceLamports(wallet.address).then(lamportsToSol, () => null) : null;

  // Everything the AI knows that didn't come from the user. Only numbers in here
  // (or in the user's messages) may show up in its replies.
  const known = [
    "What you know right now (from CardMart, not from the user):",
    tasks.length
      ? `The user's tasks:\n${tasks
          .map((t) => `- ${t.summary} (${t.status.toLowerCase()}, ${t.boughtCount} bought, ${t._count.decisions} waiting for their OK)`)
          .join("\n")}`
      : "The user has no tasks running.",
    decisions.length
      ? `The agent's latest finds:\n${decisions
          .map(
            (d) =>
              `- ${d.asset.name} ${d.asset.gradingCompany === "RAW" ? "raw" : `${d.asset.gradingCompany} ${d.asset.grade ?? ""}`.trim()} at ${d.priceThb.toLocaleString()} THB: ${DECISION_LABEL[d.status]}${d.offerThb ? ` (offered ${d.offerThb.toLocaleString()} THB)` : ""}`,
          )
          .join("\n")}`
      : null,
    alerts.length
      ? `Cards the user has alerts for: ${alerts
          .slice(0, 8)
          .map((a) => `${a.query}${a.maxPriceThb ? ` (up to ${a.maxPriceThb.toLocaleString()} THB)` : ""}`)
          .join("; ")}`
      : "The user has no card alerts.",
    balanceSol != null
      ? `Agent wallet: ${balanceSol.toFixed(3)} SOL (about ${Math.round(balanceSol * THB_PER_SOL).toLocaleString()} THB).`
      : "The agent wallet balance isn't available right now.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    return await runChatTurn({
      history,
      draft,
      known,
      market,
      lookupMarket: marketSnapshot,
      locale,
      facts: {
        feeThb: AGENT_TASK_FEE_THB,
        thbPerSol: THB_PER_SOL,
        buyerFeePercent: BUYER_FEE_PERCENT,
        listingFeeThb: SELF_MINT_FEE_THB,
        sellerShippingThb: SELLER_SHIPPING_COST_THB,
      },
    });
  } catch (err) {
    console.error("agentChat failed", err);
    return { error: "The agent couldn't answer. Try again." };
  }
}

const DECISION_LABEL: Record<string, string> = {
  PROPOSED: "waiting for the user's OK",
  OFFERED: "offer sent, waiting on the seller",
  EXECUTED: "bought",
  SKIPPED: "skipped",
  DECLINED: "declined",
};

export interface CardSuggestion {
  name: string;
  game: "POKEMON" | "ONE_PIECE";
  forSale: number;
  lowestPriceThb: number | null;
}

/** Card names on CardMart matching what's typed so far, most-listed first — for the task form's card picker. */
export async function suggestAgentCards(text: string): Promise<CardSuggestion[]> {
  await getCurrentUser();
  const q = text.trim();
  if (q.length < 2 || q.length > 80) return [];
  const assets = await prisma.asset.findMany({
    where: { name: { contains: q, mode: "insensitive" }, redeemedAt: null },
    select: { name: true, game: true, forSale: true, priceThb: true },
    take: 300,
  });
  const byName = new Map<string, CardSuggestion>();
  for (const a of assets) {
    const key = `${a.game}:${a.name}`;
    const s = byName.get(key) ?? { name: a.name, game: a.game, forSale: 0, lowestPriceThb: null };
    if (a.forSale && a.priceThb != null) {
      s.forSale++;
      s.lowestPriceThb = Math.min(s.lowestPriceThb ?? Infinity, a.priceThb);
    }
    byName.set(key, s);
  }
  return [...byName.values()]
    .sort((a, b) => b.forSale - a.forSale || a.name.localeCompare(b.name))
    .slice(0, 6);
}

const taskSchema = z
  .object({
    instruction: z.string().trim().min(8).max(600),
    summary: z.string().trim().min(3).max(200),
    query: z.string().trim().min(2, "Enter the card to look for.").max(120),
    game: z.enum(["POKEMON", "ONE_PIECE"]).nullable(),
    gradingCompanies: z.array(z.enum(["PSA", "BGS", "CGC", "RAW"])).max(4),
    minGrade: z.number().min(1).max(10).nullable(),
    blackLabelOnly: z.boolean(),
    maxPriceThb: z.number().int().min(100, "Set a maximum price of at least 100 THB.").max(1_000_000),
    budgetThb: z.number().int().min(100).max(1_000_000),
    maxCards: z.number().int().min(1).max(20),
    trustedSellersOnly: z.boolean(),
    autoBuy: z.boolean(),
    makeOffers: z.boolean().default(false),
    fulfillment: z.enum(["VAULT", "SHIP"]),
  })
  .refine((t) => t.budgetThb >= t.maxPriceThb, { message: "The total budget has to cover at least one card at your maximum price." });

export type AgentTaskInput = z.input<typeof taskSchema>;

export async function createAgentTask(input: AgentTaskInput): Promise<{ id?: string; error?: string }> {
  const user = await getCurrentUser();
  if (user.isBanned) return { error: "Your account is suspended." };
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the task details." };

  const active = await prisma.agentMandate.count({ where: { userId: user.id, status: "ACTIVE" } });
  if (active >= 5) return { error: "You can run up to 5 agent tasks at once. Pause or stop one first." };

  const wallet = await getOrCreateAgentWallet(user.id);
  // Created paused so it can't scan or buy until the fee has gone through.
  const mandate = await prisma.agentMandate.create({
    data: { ...parsed.data, userId: user.id, status: "PAUSED", feeThb: AGENT_TASK_FEE_THB },
  });

  let feeTxSignature: string | null = null;
  if (wallet && (await isAgentChainEnabled())) {
    try {
      feeTxSignature = await payAgentTaskFee(wallet, thbToLamports(AGENT_TASK_FEE_THB));
    } catch (err) {
      await prisma.agentMandate.delete({ where: { id: mandate.id } });
      console.error("Agent task fee failed", err);
      return { error: err instanceof Error ? err.message : "The task fee didn't go through. Try again." };
    }
  }

  await prisma.agentMandate.update({ where: { id: mandate.id }, data: { status: "ACTIVE", feeTxSignature } });
  revalidatePath("/agent");
  return { id: mandate.id };
}

export async function setAgentTaskStatus(mandateId: string, status: "ACTIVE" | "PAUSED" | "DONE") {
  const user = await getCurrentUser();
  await prisma.agentMandate.updateMany({ where: { id: mandateId, userId: user.id }, data: { status } });
  if (status !== "ACTIVE") {
    const own = await prisma.agentMandate.count({ where: { id: mandateId, userId: user.id } });
    if (own) await withdrawAgentOffers(mandateId);
    // Pending suggestions shouldn't be approvable once the task stops.
    await prisma.agentDecision.updateMany({
      where: { mandateId, status: "PROPOSED", mandate: { userId: user.id } },
      data: { status: "DECLINED", resolvedAt: new Date() },
    });
  }
  revalidatePath("/agent");
}

/** Devnet only: tops the agent wallet up from Solana's faucet. */
export async function airdropToAgentWallet(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const wallet = await getOrCreateAgentWallet(user.id);
  if (!wallet) return { error: "Agent wallets aren't configured on this server." };
  try {
    await requestDevnetAirdrop(wallet.address, 1);
    revalidatePath("/agent");
    return {};
  } catch {
    return { error: "The devnet faucet is busy or rate-limited. Try again in a minute, or fund it from your wallet." };
  }
}

/** Sends everything in the agent wallet back to the user's own wallet. */
export async function withdrawFromAgentWallet(): Promise<{ sol?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user.walletAddress) return { error: "Your account has no wallet to send it to." };
  const wallet = await prisma.agentWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return { error: "You don't have an agent wallet yet." };
  try {
    const result = await withdrawAgentBalance(wallet, user.walletAddress);
    revalidatePath("/agent");
    return result ? { sol: result.sol } : { error: "The agent wallet is already empty." };
  } catch (err) {
    console.error("withdrawFromAgentWallet failed", err);
    return { error: "The withdrawal didn't go through. Try again." };
  }
}
