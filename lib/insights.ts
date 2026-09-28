import { formatThb } from "@/lib/format";
import { translator, type Translate } from "@/lib/i18n/translate";

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
export function buildPriceInsights(input: InsightInput, t: Translate = translator("en")): PriceInsight[] {
  const insights: PriceInsight[] = [];
  const price = input.forSale ? input.priceThb : null;

  if (price != null) {
    for (const days of [7, 30] as const) {
      const baseline = priceAt(input.snapshots, new Date(Date.now() - days * 86_400_000));
      if (baseline && baseline !== price) {
        const change = pct(baseline, price);
        const vars = { pct: Math.abs(change).toFixed(0), days };
        insights.push({
          tone: change > 0 ? "up" : "down",
          title: change > 0 ? t("Up {pct}% in {days} days", vars) : t("Down {pct}% in {days} days", vars),
          detail: t("The seller moved the asking price from {from} to {to}.", { from: formatThb(baseline), to: formatThb(price) }),
        });
        break; // the shorter window is the more useful signal; don't repeat it for 30d
      }
    }
  }

  const { market } = input;
  if (price != null && market.medianSaleThb != null) {
    const diff = pct(market.medianSaleThb, price);
    const sales = t(market.saleCount === 1 ? "{count} completed sale in {days} days" : "{count} completed sales in {days} days", {
      count: market.saleCount,
      days: market.saleLookbackDays,
    });
    const median = formatThb(market.medianSaleThb);
    insights.push(
      Math.abs(diff) < 3
        ? {
            tone: "neutral",
            title: t("In line with recent sales"),
            detail: t("Within 3% of the {median} median sale price ({sales}).", { median, sales }),
          }
        : {
            tone: diff > 0 ? "up" : "down",
            title: t(diff > 0 ? "{pct}% above the median sale" : "{pct}% below the median sale", { pct: Math.abs(diff).toFixed(0) }),
            detail: t("This exact card's median sale price on CardMart is {median} ({sales}).", { median, sales }),
          },
    );
  } else if (market.saleCount === 0) {
    insights.push({
      tone: "neutral",
      title: t("No CardMart sales yet"),
      detail: t("This exact card and grade hasn't sold here in the last 90 days. Compare with the outside prices below."),
    });
  }

  if (price != null && market.listingCount > 1 && market.lowestAskThb != null) {
    insights.push(
      price <= market.lowestAskThb
        ? {
            tone: "down",
            title: t("Lowest ask on CardMart"),
            detail: t("Cheapest of {count} live listings for this exact card.", { count: market.listingCount }),
          }
        : {
            tone: "up",
            title: t("{amount} above the lowest ask", { amount: formatThb(price - market.lowestAskThb) }),
            detail: t("{count} listings of this exact card are live; the cheapest is {lowest}.", {
              count: market.listingCount,
              lowest: formatThb(market.lowestAskThb),
            }),
          },
    );
  }

  if (input.isBlackLabel) {
    insights.push({
      tone: "up",
      title: t("Black Label rarity"),
      detail: t("Every BGS sub-grade is a perfect 10 — the rarest tier BGS awards, which usually commands a premium over a regular 10."),
    });
  }

  if (input.psa?.totalPopulation != null) {
    const higher = input.psa.populationHigher;
    insights.push({
      tone: "neutral",
      title: t("PSA population: {count} at this grade", { count: input.psa.totalPopulation.toLocaleString() }),
      detail:
        higher === 0
          ? t("None graded higher — this is the top grade PSA has given this card.")
          : higher != null
            ? t("{count} graded higher. A lower population usually means more scarcity.", { count: higher.toLocaleString() })
            : t("A lower population usually means more scarcity."),
    });
  }

  if (input.watcherCount > 0 || input.pendingOffers > 0) {
    const parts = [
      input.watcherCount > 0 &&
        t(input.watcherCount === 1 ? "{count} collector is watching" : "{count} collectors are watching", { count: input.watcherCount }),
      input.pendingOffers > 0 &&
        t(input.pendingOffers === 1 ? "{count} offer pending" : "{count} offers pending", { count: input.pendingOffers }),
    ].filter(Boolean);
    insights.push({ tone: "neutral", title: t("Buyer interest"), detail: `${parts.join(" · ")}.` });
  }

  return insights;
}
