import "server-only";

// Real integration with TCG API (https://tcgapi.dev), used as a reference
// market-price source since PSA's own public API has no pricing endpoint at
// all (confirmed against their live swagger spec). Free tier: 100 req/day,
// no card required — see README for how to get a key.
//
// Important limitation, confirmed by testing the live endpoint directly:
// this returns TCGPlayer market pricing for the RAW/ungraded card — there
// is no PSA/BGS grade-tier field anywhere in the response. A PSA 10 is
// worth substantially more than this number for most cards. Every caller
// must label this as a raw/reference price, never as "the price" of a
// graded listing. It's also Pokemon/TCG-specific — no sports cards or
// comics coverage — so callers should only use this for TRADING_CARD.
const TCG_API_BASE = "https://api.tcgapi.dev/v1";

export function isTcgPriceConfigured(): boolean {
  return Boolean(process.env.TCG_API_KEY);
}

export interface CardPriceQuote {
  /** The exact card name/set/number TCG API matched — shown to the user so they can judge whether it's really the same print. */
  matchedName: string;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  printing: string | null;
  /** USD — TCGPlayer is a US marketplace, no currency conversion applied. */
  marketPriceUsd: number | null;
  lowPriceUsd: number | null;
  imageUrl: string | null;
  updatedAt: string | null;
}

async function searchOnce(query: string): Promise<CardPriceQuote | null> {
  const res = await fetch(`${TCG_API_BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: { "X-API-Key": process.env.TCG_API_KEY! },
    // Shared cache across every visitor searching the same query — the free
    // tier is only 100 requests/day, so this is load-bearing, not just an
    // optimization.
    next: { revalidate: 21600 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  // The catalog also indexes non-card merch under the same search (seen in
  // testing: "Michael Jordan" top-matched a Funko Pop, product_type "Sealed
  // Products") — only take an actual card, never just the top hit.
  const card = (data?.data as unknown[] | undefined)?.find(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && (item as Record<string, unknown>).product_type === "Cards",
  );
  if (!card) return null;

  return {
    matchedName: typeof card.name === "string" ? card.name : query,
    setName: typeof card.set_name === "string" ? card.set_name : null,
    cardNumber: typeof card.number === "string" ? card.number : null,
    rarity: typeof card.rarity === "string" ? card.rarity : null,
    printing: typeof card.printing === "string" ? card.printing : null,
    marketPriceUsd: typeof card.market_price === "number" ? card.market_price : null,
    lowPriceUsd: typeof card.low_price === "number" ? card.low_price : null,
    imageUrl: typeof card.image_url === "string" ? card.image_url : null,
    updatedAt: typeof card.price_updated_at === "string" ? card.price_updated_at : null,
  };
}

/**
 * Best-effort raw-card reference price lookup by free-text name (e.g. our
 * Asset.name, which is a full descriptive title like "Charizard VMAX
 * Rainbow Rare" — not the plain card name TCG API's own `name` field holds).
 * Tested against the real endpoint: the search matches on that plain name,
 * so extra descriptor words (rarity, edition, parallel) return zero results
 * outright, not a fuzzy/partial match.
 *
 * So this retries with progressively fewer trailing words until something
 * matches. It stops at a 2-word floor rather than falling all the way to a
 * single word — a single generic word (seen in testing: "Raw" from "Raw
 * Pikachu Illustrator Reprint", itself just seed flavor text) can match
 * thousands of unrelated cards and return a confidently wrong price. Fewer,
 * more trustworthy matches beat a wrong dollar figure next to a listing.
 */
export async function lookupCardPrice(rawQuery: string): Promise<CardPriceQuote | null> {
  if (!isTcgPriceConfigured()) return null;

  const words = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const minWords = Math.min(2, words.length);

  try {
    for (let take = words.length; take >= minWords; take--) {
      const match = await searchOnce(words.slice(0, take).join(" "));
      if (match) return match;
    }
    return null;
  } catch {
    return null;
  }
}
