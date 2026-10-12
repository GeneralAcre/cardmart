// Bid rules shared by the auction page, the bid panel and placeBid, so what
// the page offers is exactly what the server accepts.

type AuctionPrices = {
  currentBidThb: number | null;
  startPriceThb: number;
  // The seller's own bid step. Null on auctions created before sellers could
  // set one: those keep the automatic, price-scaled step.
  bidIncrementThb?: number | null;
};

// Limits on a seller's bid step: at least this many THB, and never more than
// the starting price, so the second bid can't be forced to double the first.
export const MIN_BID_STEP_THB = 10;

/** The automatic step, scaled to the price so a step means something on any card. Also the form's suggestion. */
export function bidIncrement(priceThb: number): number {
  if (priceThb < 1_000) return 50;
  if (priceThb < 10_000) return 100;
  if (priceThb < 50_000) return 500;
  return 1_000;
}

/** Why a seller's bid step can't be used, or null when it can. */
export function bidStepProblem(stepThb: number, startPriceThb: number): string | null {
  if (!Number.isInteger(stepThb) || stepThb < MIN_BID_STEP_THB) return `Set a bid step of at least ${MIN_BID_STEP_THB} THB.`;
  if (stepThb > startPriceThb) return "The bid step can't be more than the starting price.";
  return null;
}

/**
 * The lowest bid allowed now: the starting price for the first bid, then the
 * current bid plus one step.
 */
export function minNextBid(auction: AuctionPrices): number {
  if (auction.currentBidThb == null) return auction.startPriceThb;
  return auction.currentBidThb + (auction.bidIncrementThb ?? bidIncrement(auction.currentBidThb));
}

/** Bids go up in whole steps from the minimum: the seller's step, or the automatic one at the minimum's price. */
export function bidStep(auction: AuctionPrices): number {
  return auction.bidIncrementThb ?? bidIncrement(minNextBid(auction));
}

/** Why an amount isn't a valid bid right now, or null when it is. */
export function bidAmountProblem(amountThb: number, auction: AuctionPrices): string | null {
  const min = minNextBid(auction);
  const step = bidStep(auction);
  if (!Number.isInteger(amountThb) || amountThb < min) return `Bid at least ${min.toLocaleString()} THB.`;
  if ((amountThb - min) % step !== 0) {
    return `Bids go up in steps of ${step.toLocaleString()} THB from ${min.toLocaleString()} THB.`;
  }
  return null;
}
