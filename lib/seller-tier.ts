// Top Tier Seller: the badge for sellers with a proven record. One rule, used
// by the badge on store and card pages and by the checklist on Rewards, so the
// two can never disagree. Plain module (no server-only code) so either side can import it.

export const TOP_TIER_SELLER = {
  /** Completed sales: paid out to the seller after warehouse checks. */
  sales: 10,
  /** Reviews received, so the rating rests on more than one or two buyers. */
  reviews: 5,
  /** Average review rating, out of 5. */
  rating: 4.5,
} as const;

export interface SellerStanding {
  sales: number;
  reviews: number;
  /** Average rating, or null with no reviews yet. */
  rating: number | null;
  verified: boolean;
}

/** All four: enough sales, enough reviews, a high rating, and a verified identity. */
export function isTopTierSeller(s: SellerStanding): boolean {
  return (
    s.verified &&
    s.sales >= TOP_TIER_SELLER.sales &&
    s.reviews >= TOP_TIER_SELLER.reviews &&
    (s.rating ?? 0) >= TOP_TIER_SELLER.rating
  );
}
