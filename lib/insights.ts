import { formatThb } from "@/lib/format";

export interface PriceInsight {
  tone: "up" | "down" | "neutral";
  title: string;
  detail: string;
}

interface InsightInput {
  priceThb: number | null;
  forSale: boolean;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  snapshots: { priceThb: number; createdAt: Date }[];
  watcherCount: number;
  pendingOffers: number;
  market: {
    saleCount: number;
    medianSaleThb: number | null;
    listingCount: number;
    lowestAskThb: number | null;
    saleLookbackDays: number;
  };
  psa: { totalPopulation: number | null; populationHigher: number | null } | null;
}

/** The listing's price at the start of a window: the last snapshot on or before it, else the first one inside it. */
function priceAt(snapshots: InsightInput["snapshots"], since: Date): number | null {
  let baseline: number | null = null;
  for (const s of snapshots) {
    if (s.createdAt <= since) baseline = s.priceThb;
    else return baseline ?? s.priceThb;
  }
  return baseline;
}

function pct(from: number, to: number) {
  return ((to - from) / from) * 100;
}

/**
 * Plain-language insights for one listing, derived only from real data: this
 * listing's own price history, completed CardMart sales and live listings of
 * the same card, PSA population figures, and current buyer interest. Returns
 * nothing it can't back with a number — no news feeds, no predictions.
 */
export function buildPriceInsights(input: InsightInput): PriceInsight[] {
  const insights: PriceInsight[] = [];
  const price = input.forSale ? input.priceThb : null;

  if (price != null) {
    for (const days of [7, 30] as const) {
      const baseline = priceAt(input.snapshots, new Date(Date.now() - days * 86_400_000));
      if (baseline && baseline !== price) {
        const change = pct(baseline, price);
        insights.push({
          tone: change > 0 ? "up" : "down",
          title: `${change > 0 ? "Up" : "Down"} ${Math.abs(change).toFixed(0)}% in ${days} days`,
          detail: `The seller moved the asking price from ${formatThb(baseline)} to ${formatThb(price)}.`,
        });
        break; // the shorter window is the more useful signal; don't repeat it for 30d
      }
    }
  }

  const { market } = input;
  if (price != null && market.medianSaleThb != null) {
    const diff = pct(market.medianSaleThb, price);
    const sales = `${market.saleCount} completed sale${market.saleCount === 1 ? "" : "s"} in ${market.saleLookbackDays} days`;
    insights.push(
      Math.abs(diff) < 3
        ? { tone: "neutral", title: "In line with recent sales", detail: `Within 3% of the ${formatThb(market.medianSaleThb)} median sale price (${sales}).` }
        : {
            tone: diff > 0 ? "up" : "down",
            title: `${Math.abs(diff).toFixed(0)}% ${diff > 0 ? "above" : "below"} the median sale`,
            detail: `This exact card's median sale price on CardMart is ${formatThb(market.medianSaleThb)} (${sales}).`,
          },
    );
  } else if (market.saleCount === 0) {
    insights.push({
      tone: "neutral",
      title: "No CardMart sales yet",
      detail: "This exact card and grade hasn't sold here in the last 90 days. Compare with the outside prices below.",
    });
  }

  if (price != null && market.listingCount > 1 && market.lowestAskThb != null) {
    insights.push(
      price <= market.lowestAskThb
        ? { tone: "down", title: "Lowest ask on CardMart", detail: `Cheapest of ${market.listingCount} live listings for this exact card.` }
        : {
            tone: "up",
            title: `${formatThb(price - market.lowestAskThb)} above the lowest ask`,
            detail: `${market.listingCount} listings of this exact card are live; the cheapest is ${formatThb(market.lowestAskThb)}.`,
          },
    );
  }

  if (input.isBlackLabel) {
    insights.push({
      tone: "up",
      title: "Black Label rarity",
      detail: "Every BGS sub-grade is a perfect 10 — the rarest tier BGS awards, which usually commands a premium over a regular 10.",
    });
  }

  if (input.psa?.totalPopulation != null) {
    const higher = input.psa.populationHigher;
    insights.push({
      tone: "neutral",
      title: `PSA population: ${input.psa.totalPopulation.toLocaleString()} at this grade`,
      detail:
        higher === 0
          ? "None graded higher — this is the top grade PSA has given this card."
          : higher != null
            ? `${higher.toLocaleString()} graded higher. A lower population usually means more scarcity.`
            : "A lower population usually means more scarcity.",
    });
  }

  if (input.watcherCount > 0 || input.pendingOffers > 0) {
    const parts = [
      input.watcherCount > 0 && `${input.watcherCount} collector${input.watcherCount === 1 ? " is" : "s are"} watching`,
      input.pendingOffers > 0 && `${input.pendingOffers} offer${input.pendingOffers === 1 ? "" : "s"} pending`,
    ].filter(Boolean);
    insights.push({ tone: "neutral", title: "Buyer interest", detail: `${parts.join(" · ")}.` });
  }

  return insights;
}
