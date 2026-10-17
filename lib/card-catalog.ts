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
  number?: string;
  rarity?: string | null;
}

/**
 * Finds the catalogue image for one card, or null when there's no confident
 * match. A result only counts if it's the right game AND its set shares a
 * word with the listing's subtitle (e.g. "Evolving Skies"), so a wrong
 * printing's picture is never shown just because the name matched.
 */
export async function findCatalogImage(card: { name: string; subtitle: string; game: CardGame }): Promise<string | null> {
  return (await findCatalogCard(card))?.imageUrl ?? null;
}

/**
 * The catalogue's best match for one card — its reference image and printed
 * number (e.g. "215/203") — or null when there's no confident match. Same
 * matching rules as findCatalogImage, from one API call.
 */
export async function findCatalogCard(card: {
  name: string;
  subtitle: string;
  game: CardGame;
  /** When known, the result with this exact printed number wins, so a special print isn't mistaken for the regular one. */
  cardNumber?: string | null;
}): Promise<{ imageUrl: string; number: string | null; rarity: string | null } | null> {
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
  let best: { score: number; url: string; number: string | null; rarity: string | null; numberMatch: boolean } | null = null;
  const wantNumber = card.cardNumber ? normalizeNumber(card.cardNumber) : null;

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
    const number = r.number?.trim() && numberFits(card.subtitle, r.set_name ?? "", r.number.trim()) ? r.number.trim() : null;
    const rarity = typeof r.rarity === "string" && r.rarity !== "None" ? r.rarity : null;
    // The same card name is printed many times (regular, illustration rare,
    // secret…); the printed number is what tells them apart.
    const numberMatch = wantNumber != null && r.number != null && normalizeNumber(r.number) === wantNumber;
    const total = score + (numberMatch ? 20 : 0);
    if (!best || total > best.score) best = { score: total, url: r.image_url, number, rarity, numberMatch };
  }
  if (!best) return null;
  // A rarity from a different printing would be wrong, so only trust it on a number match (or when there's no number to check).
  return { imageUrl: best.url, number: best.number, rarity: wantNumber == null || best.numberMatch ? best.rarity : null };
}

/** "095/203" → "95/203", "OP01-120" → "op01-120": comparable printed numbers. */
function normalizeNumber(n: string): string {
  return n
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(^|\/)0+(?=\d)/g, "$1");
}

const setWords = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !/^(19|20)\d\d$/.test(w));

/**
 * A close-enough picture is fine, but a card number has to be exact: the
 * catalogue set must BE one of the subtitle's sets ("Base Set 2" is not
 * "Base Set"), ignoring its code prefix ("SWSH07: Evolving Skies"), and a
 * One Piece set code in the subtitle (OP05) must match the number's prefix.
 */
function numberFits(subtitle: string, catalogSet: string, number: string): boolean {
  const catalog = setWords(catalogSet.replace(/^[^:]*:\s*/, "")).join(" ");
  const parts = subtitle.split(/[—–|]/).map((p) => setWords(p).join(" ")).filter(Boolean);
  if (!parts.includes(catalog)) return false;
  const code = subtitle.match(/\b([A-Z]{2,4}\d{2})\b/)?.[1];
  const prefix = number.match(/^([A-Z]{2,4}\d{2})-/i)?.[1];
  return !code || !prefix || code.toUpperCase() === prefix.toUpperCase();
}
