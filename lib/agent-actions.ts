"use server";

// Buying agent: setting up tasks and managing the agent wallet. Scanning and
// buying live in lib/actions.ts (they reuse the escrow purchase code).
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAgentAiConfigured, planMandate, type MandatePlan } from "@/lib/agent/ai";
import { getOrCreateAgentWallet, withdrawAgentBalance } from "@/lib/agent/wallet";
import { requestDevnetAirdrop } from "@/lib/solana";

export async function planAgentTask(instruction: string): Promise<{ plan?: MandatePlan; error?: string }> {
  await getCurrentUser();
  const text = instruction.trim();
  if (text.length < 8) return { error: "Describe the card you want, and your maximum price." };
  if (text.length > 600) return { error: "Keep it under 600 characters." };
  if (!isAgentAiConfigured()) return { error: "The buying agent isn't switched on yet (ANTHROPIC_API_KEY is missing)." };
  try {
    const plan = await planMandate(text);
    if (!plan.understood) return { error: "That doesn't look like a card to buy. Try naming the card and your maximum price." };
    return { plan };
  } catch (err) {
    console.error("planAgentTask failed", err);
    return { error: err instanceof Error ? err.message : "The agent couldn't plan that. Try again." };
  }
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

  await getOrCreateAgentWallet(user.id);
  const mandate = await prisma.agentMandate.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath("/agent");
  return { id: mandate.id };
}

export async function setAgentTaskStatus(mandateId: string, status: "ACTIVE" | "PAUSED" | "DONE") {
  const user = await getCurrentUser();
  await prisma.agentMandate.updateMany({ where: { id: mandateId, userId: user.id }, data: { status } });
  if (status !== "ACTIVE") {
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
