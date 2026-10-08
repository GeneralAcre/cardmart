// Bid rules shared by the auction page, the bid panel and placeBid, so what
// the page offers is exactly what the server accepts.

/** The step bids move in, scaled to the price so a step means something on any card. */
export function bidIncrement(priceThb: number): number {
  if (priceThb < 1_000) return 50;
  if (priceThb < 10_000) return 100;
  if (priceThb < 50_000) return 500;
  return 1_000;
}

/**
 * The lowest bid allowed now: the starting price for the first bid, then the
 * current bid plus one step.
 */
export function minNextBid(auction: { currentBidThb: number | null; startPriceThb: number }): number {
  if (auction.currentBidThb == null) return auction.startPriceThb;
  return auction.currentBidThb + bidIncrement(auction.currentBidThb);
}

/** Bids go up in whole steps from the minimum, using the step at the minimum's price. */
export function bidStep(auction: { currentBidThb: number | null; startPriceThb: number }): number {
  return bidIncrement(minNextBid(auction));
}

/** Why an amount isn't a valid bid right now, or null when it is. */
export function bidAmountProblem(
  amountThb: number,
  auction: { currentBidThb: number | null; startPriceThb: number },
): string | null {
  const min = minNextBid(auction);
  const step = bidStep(auction);
  if (!Number.isInteger(amountThb) || amountThb < min) return `Bid at least ${min.toLocaleString()} THB.`;
  if ((amountThb - min) % step !== 0) {
    return `Bids go up in steps of ${step.toLocaleString()} THB from ${min.toLocaleString()} THB.`;
  }
  return null;
}
