import type { CardGame } from "@prisma/client";

// Official card images from TCGplayer's catalogue (via TCG API), used so
// buyers can recognise a card at a glance when a listing has no real
// verification photo yet. It's a REFERENCE image of the card, not a photo of
// the physical copy being sold, and the UI labels it that way.
//
// Looked up once per listing (createListing) and stored on
// Asset.catalogImageUrl, never per page view — the TCG API key allows 100
// requests a day, shared with prices and the release calendar.

const TCG_API_BASE = "https://api.tcgapi.dev/v1";

const GAME_SLUGS: Record<CardGame, string> = {
  POKEMON: "pokemon",
  ONE_PIECE: "one-piece-card-game",
};

// Words collectors add to a listing title that aren't part of the catalogue's
// card name — stripped for the search, then used to prefer the right variant.
const VARIANT_HINTS: { pattern: RegExp; resultIncludes: string }[] = [
  { pattern: /\balt(ernate)?\.? art\b/i, resultIncludes: "alternate art" },
  { pattern: /\bmanga\b/i, resultIncludes: "manga" },
  { pattern: /\brainbow\b/i, resultIncludes: "secret" },
  { pattern: /\b1st edition\b/i, resultIncludes: "1st edition" },
];
const NOISE = /\b(alt(ernate)?\.? art|rainbow rare|rainbow|manga rare|manga|holo|1st edition|illustrator reprint|reprint|raw|secret rare)\b/gi;
const STOPWORDS = new Set(["the", "and", "of", "a", "an", "set", "edition", "promo", "print", "run", "unverified"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d{4}$/.test(t));
}

interface SearchResult {
  name?: string;
  set_name?: string;
  game_slug?: string;
  image_url?: string;
  product_type?: string;
}

/**
 * Finds the catalogue image for one card, or null when there's no confident
 * match. A result only counts if it's the right game AND its set shares a
 * word with the listing's subtitle (e.g. "Evolving Skies"), so a wrong
 * printing's picture is never shown just because the name matched.
 */
export async function findCatalogImage(card: { name: string; subtitle: string; game: CardGame }): Promise<string | null> {
  const key = process.env.TCG_API_KEY?.trim();
  if (!key) return null;

  const query = card.name.replace(NOISE, " ").replace(/\s+/g, " ").trim();
  if (query.length < 2) return null;

  let results: SearchResult[];
  try {
    const res = await fetch(`${TCG_API_BASE}/search?q=${encodeURIComponent(query)}`, {
      headers: { "X-API-Key": key },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[card-catalog] search failed: HTTP ${res.status}`);
      return null;
    }
    const body = await res.json();
    results = Array.isArray(body?.data) ? body.data : [];
  } catch (err) {
    console.warn("[card-catalog] search error:", err);
    return null;
  }

  const subtitleTokens = tokens(card.subtitle);
  const hints = VARIANT_HINTS.filter((h) => h.pattern.test(card.name));
  let best: { score: number; url: string } | null = null;

  for (const r of results) {
    if (r.game_slug !== GAME_SLUGS[card.game] || !r.image_url || (r.product_type && r.product_type !== "Cards")) continue;
    const setName = (r.set_name ?? "").toLowerCase();
    const setScore = subtitleTokens.filter((t) => setName.includes(t)).length;
    if (setScore === 0) continue;
    const name = (r.name ?? "").toLowerCase();
    const hintScore = hints.filter((h) => name.includes(h.resultIncludes)).length;
    // A variant the listing didn't ask for (e.g. "(Secret)") is a worse match.
    const unaskedVariant = /\(/.test(name) && hints.length === 0 ? 1 : 0;
    const score = setScore * 3 + hintScore * 4 - unaskedVariant;
    if (!best || score > best.score) best = { score, url: r.image_url };
  }
  return best?.url ?? null;
}
