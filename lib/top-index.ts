import "server-only";

import type { CardGame } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// The Pokémon and One Piece indexes: the TOP_N most valuable cards in each
// game by TCGplayer's market price (ungraded), re-ranked every day, so a card
// that falls out of the top 50 leaves the index and the next one joins.
//
// The prices come from tcgcsv.com, a free daily copy of TCGplayer's catalog:
// one prices file and one products file per set. It has no daily request cap
// (unlike the TCG API plan, which allows 100 calls a day) and is refreshed
// about 20:00 UTC, so this runs once a day after that (see vercel.json).

const BASE = "https://tcgcsv.com/tcgplayer";
const CATEGORIES: Record<CardGame, number> = { POKEMON: 3, ONE_PIECE: 68 };
// A polite, identifying agent: the service refuses anonymous default ones.
const HEADERS = { "User-Agent": "CardMart/1.0 (daily card index; contact: acreforcoding@gmail.com)" };

export const TOP_N = 50;
/** Saved per day: the index plus a buffer, so a card that just dropped out still has a price. */
export const POOL = 100;
const CONCURRENCY = 8;

interface Group {
  groupId: number;
  name: string;
}
interface PriceRow {
  productId: number;
  marketPrice: number | null;
  subTypeName: string | null;
}
interface Product {
  productId: number;
  name: string;
  extendedData?: { name: string; value: string }[];
}

export interface TopCard {
  productId: number;
  rank: number;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  imageUrl: string;
  priceUsd: number;
}

async function getResults<T>(url: string): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
      if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
      return ((await res.json()).results ?? []) as T[];
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

/** Runs `fn` over `items`, a few at a time. */
async function inBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Card art for a TCGplayer product, on the image host the app already allows. */
const imageUrl = (productId: number) => `https://product-images.tcgplayer.com/fit-in/200x279/${productId}.jpg`;

/**
 * The POOL most valuable single cards in a game right now, most valuable
 * first. Reads every set's prices, ranks every product by its market price,
 * then looks up only as many products as it takes to find POOL actual cards:
 * sealed boxes and accessories have no card number, and are skipped.
 */
export async function fetchTopCards(game: CardGame): Promise<TopCard[]> {
  const category = CATEGORIES[game];
  const groups = await getResults<Group>(`${BASE}/${category}/groups`);
  const setName = new Map(groups.map((g) => [g.groupId, g.name]));

  const priced = await inBatches(groups, async (g) => {
    // One set failing to load shouldn't sink the whole ranking.
    const rows = await getResults<PriceRow>(`${BASE}/${category}/${g.groupId}/prices`).catch(() => [] as PriceRow[]);
    return rows.map((r) => ({ ...r, groupId: g.groupId }));
  });

  // A product can have several finishes (Normal, Holofoil…); rank by its highest.
  const best = new Map<number, PriceRow & { groupId: number }>();
  for (const row of priced.flat()) {
    if (!row.marketPrice || row.marketPrice <= 0) continue;
    const current = best.get(row.productId);
    if (!current || row.marketPrice > (current.marketPrice ?? 0)) best.set(row.productId, row);
  }
  const ranked = [...best.values()].sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0));

  const products = new Map<number, Map<number, Product>>();
  const cards: TopCard[] = [];
  for (const row of ranked) {
    if (!products.has(row.groupId)) {
      const list = await getResults<Product>(`${BASE}/${category}/${row.groupId}/products`).catch(() => [] as Product[]);
      products.set(row.groupId, new Map(list.map((p) => [p.productId, p])));
    }
    const product = products.get(row.groupId)!.get(row.productId);
    if (!product) continue;
    const extended = Object.fromEntries((product.extendedData ?? []).map((e) => [e.name, e.value]));
    // Single cards have a printed number; sealed product and accessories don't.
    if (!extended.Number) continue;
    cards.push({
      productId: row.productId,
      rank: cards.length + 1,
      name: product.name,
      setName: setName.get(row.groupId) ?? "",
      cardNumber: extended.Number,
      rarity: extended.Rarity ?? null,
      imageUrl: imageUrl(row.productId),
      priceUsd: row.marketPrice!,
    });
    if (cards.length >= POOL) break;
  }
  return cards;
}

/**
 * Re-ranks both games and saves today's top POOL (replacing any earlier run
 * today). Returns how many cards were saved per game. A game whose source
 * can't be read keeps its previous days untouched.
 */
export async function refreshTopIndexes(now = new Date()): Promise<Record<string, number>> {
  const day = new Date(now.toISOString().slice(0, 10));
  const saved: Record<string, number> = {};
  for (const game of Object.keys(CATEGORIES) as CardGame[]) {
    const cards = await fetchTopCards(game);
    // Fewer than TOP_N cards means the feed was incomplete: don't overwrite a good day with it.
    if (cards.length < TOP_N) {
      saved[game] = 0;
      continue;
    }
    // The download above takes a while, so the database may have gone idle:
    // allow a generous wait for the write to start.
    await prisma.$transaction(
      async (tx) => {
        await tx.indexPrice.deleteMany({ where: { game, day } });
        await tx.indexPrice.createMany({
          data: cards.map((c) => ({
            game,
            day,
            productId: c.productId,
            rank: c.rank,
            name: c.name,
            setName: c.setName,
            cardNumber: c.cardNumber,
            rarity: c.rarity,
            imageUrl: c.imageUrl,
            priceUsd: c.priceUsd,
          })),
        });
      },
      { maxWait: 30_000, timeout: 60_000 },
    );
    saved[game] = cards.length;
  }
  return saved;
}
