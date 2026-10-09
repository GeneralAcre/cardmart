import "server-only";

import { prisma } from "@/lib/prisma";
import { lookupEbayPrice, type EbayPriceQuote, type MarketCard } from "@/lib/ebay";
import { tierKey, type GradeTier } from "@/lib/grade-tier";

// A daily record of eBay's market price for each card and grade (see the
// MarketPriceSnapshot model). Nothing is backfilled or estimated: a card's
// history starts the first day anyone views it or the daily cron prices it.

/** The card itself, regardless of grade: two listings with the same key are the same print. */
export function marketCardKey(card: Pick<MarketCard, "name" | "subtitle" | "cardNumber" | "language">): string {
  return [card.name, card.subtitle, card.cardNumber ?? "", card.language ?? "ENGLISH"]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

/** Saves today's eBay quote for this card and grade, replacing any earlier one from today. */
export async function recordMarketPrice(card: MarketCard, quote: EbayPriceQuote): Promise<void> {
  const cardKey = marketCardKey(card);
  const key = tierKey(card);
  const day = new Date(new Date().toISOString().slice(0, 10));
  const values = {
    medianUsd: quote.medianPriceUsd,
    lowUsd: quote.lowPriceUsd,
    highUsd: quote.highPriceUsd,
    itemCount: quote.itemCount,
  };
  await prisma.marketPriceSnapshot.upsert({
    where: { cardKey_tierKey_day: { cardKey, tierKey: key, day } },
    create: { cardKey, tierKey: key, day, ...values },
    update: values,
  });
}

/** Every saved day of eBay prices for this card, in all grades, oldest first. */
export async function getMarketPriceHistory(card: Pick<MarketCard, "name" | "subtitle" | "cardNumber" | "language">) {
  const rows = await prisma.marketPriceSnapshot.findMany({
    where: { cardKey: marketCardKey(card) },
    orderBy: { day: "asc" },
    select: { tierKey: true, day: true, medianUsd: true, itemCount: true },
  });
  return rows.map((r) => ({ ...r, day: r.day.toISOString().slice(0, 10) }));
}

/**
 * Prices each card and grade on eBay and saves the result, for the daily
 * cron, so a card's history keeps growing on days nobody opens its page.
 */
export async function snapshotMarketPrices(cards: (MarketCard & GradeTier)[]): Promise<number> {
  const unique = new Map(cards.map((card) => [`${marketCardKey(card)}#${tierKey(card)}`, card]));
  let saved = 0;
  // A few at a time, to stay polite to eBay's rate limit.
  const queue = [...unique.values()];
  for (let i = 0; i < queue.length; i += 4) {
    await Promise.all(
      queue.slice(i, i + 4).map(async (card) => {
        const quote = await lookupEbayPrice(card).catch(() => null);
        if (!quote) return;
        await recordMarketPrice(card, quote);
        saved++;
      }),
    );
  }
  return saved;
}
