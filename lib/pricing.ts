export const SELF_MINT_FEE_THB = 50;

export const FULL_SERVICE_COST_BREAKDOWN = {
  shippingToGraderThb: 300,
  gradingFeeThb: 1000,
  mintingFeeThb: 200,
} as const;

export const FULL_SERVICE_PACKAGE_PRICE_THB = Object.values(
  FULL_SERVICE_COST_BREAKDOWN,
).reduce((sum, n) => sum + n, 0);

/** Flat mock domestic shipping cost the seller bears when their self-minted item sells and ships. */
export const SELLER_SHIPPING_COST_THB = 150;

// Fixed illustrative THB/SOL rate used only to size the real devnet escrow
// lock in lib/web3/escrow-program.ts — there's no live payment gateway or
// FX oracle behind this project, so a real production version would need
// one. This just makes the locked SOL amount scale with the item's THB
// price instead of being a flat, price-blind nominal amount.
export const THB_PER_SOL = 5000;
const LAMPORTS_PER_SOL = 1_000_000_000;

export function thbToLamports(amountThb: number): bigint {
  return BigInt(Math.round((amountThb / THB_PER_SOL) * LAMPORTS_PER_SOL));
}
