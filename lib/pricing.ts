export const SELF_MINT_FEE_THB = 50;

export const FULL_SERVICE_COST_BREAKDOWN = {
  shippingToGraderThb: 300,
  gradingFeeThb: 1000,
  mintingFeeThb: 200,
} as const;

export const FULL_SERVICE_PACKAGE_PRICE_THB = Object.values(
  FULL_SERVICE_COST_BREAKDOWN,
).reduce((sum, n) => sum + n, 0);

/**
 * What starting one buying-agent task costs, paid from the agent wallet to the
 * platform. It covers the AI calls the task makes, which is why one task only
 * reviews up to AGENT_TASK_MAX_REVIEWS listings before it finishes.
 */
export const AGENT_TASK_FEE_THB = 50;
// Worst case is one judging call per review. On the default DeepSeek V4 Pro
// that's well under $0.002, so 300 keeps a task's AI cost far below its fee
// (≈ $1.50). Lower it if OPENROUTER_JUDGE_MODEL is set to a pricier model.
export const AGENT_TASK_MAX_REVIEWS = 300;
/** Free "Plan it" requests per user per day (each one is an AI call). */
export const AGENT_PLANS_PER_DAY = 30;

/**
 * Buyer protection: what CardMart charges the buyer on top of the price for
 * escrow and inspection (Buy Now, accepted offers, agent buys). Paid to the
 * platform wallet in the same transaction as the escrow lock, and refunded
 * with it if the sale is cancelled.
 */
export const BUYER_FEE_PERCENT = 3;
export function buyerFeeThb(priceThb: number): number {
  return Math.round((priceThb * BUYER_FEE_PERCENT) / 100);
}

/** Flat mock domestic shipping cost the seller bears when their self-minted item sells and ships. */
export const SELLER_SHIPPING_COST_THB = 150;

// Fixed illustrative THB/SOL rate used only to size the real devnet escrow
// lock in lib/web3/escrow-program.ts — there's no live payment gateway or
// FX oracle behind this project, so a real production version would need
// one. This just makes the locked SOL amount scale with the item's THB
// price instead of being a flat, price-blind nominal amount.
export const THB_PER_SOL = 5000;

// Fixed approximate USD→THB rate, used only to place outside (USD) prices on
// the same baht scale in the item page's price comparison. Always shown with
// "≈" next to the original USD figure — never used for any payment.
export const THB_PER_USD = 33;
const LAMPORTS_PER_SOL = 1_000_000_000;

export function thbToLamports(amountThb: number): bigint {
  return BigInt(Math.round((amountThb / THB_PER_SOL) * LAMPORTS_PER_SOL));
}
