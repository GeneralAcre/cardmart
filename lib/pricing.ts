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
