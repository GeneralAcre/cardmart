import "server-only";

// Real integration with eBay's Buy Browse API
// (https://developer.ebay.com/api-docs/buy/browse/overview.html), used as
// the market-price reference for every category — unlike the TCG API
// integration (lib/tcg-price.ts), which only covers raw/ungraded Pokemon
// cards, eBay actually has listings for graded sports cards and comics too,
// and its search can be scoped to a specific grading company + grade.
//
// Important, deliberate limitation: eBay's self-serve Browse API only
// returns ACTIVE (currently listed) items — real "sold price" data lives
// behind the Marketplace Insights API, which is limited-release and
// requires a separate application/approval from eBay (the same kind of gate
// PSA's own API sits behind — see lib/psa.ts). So the median/low/high here
// are honestly labeled as current asking prices, never as "sold" prices.
// Getting real historical *sold* comps without fabricating anything relies
// on the manual "View sold listings on eBay" link below instead, which
// deep-links straight into eBay's own sold/completed search — that needs no
// API key at all and is always shown, even when the API isn't configured.
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_BASE = "https://api.ebay.com/buy/browse/v1";
const EBAY_CACHE_SECONDS = 600;

export function isEbayConfigured(): boolean {
  return Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID);
}

/**
 * Deep-links directly into eBay's own "sold, completed listings" search —
 * exactly what a collector would use to price-check by hand. This needs no
 * API key or app approval at all, so it's shown unconditionally, regardless
 * of whether EBAY_APP_ID/EBAY_CERT_ID are configured.
 */
export function ebaySoldListingsUrl(query: string): string {
  const sp = new URLSearchParams({ _nkw: query, LH_Sold: "1", LH_Complete: "1" });
  return `https://www.ebay.com/sch/i.html?${sp.toString()}`;
}

export interface EbayPriceQuote {
  query: string;
  itemCount: number;
  medianPriceUsd: number;
  lowPriceUsd: number;
  highPriceUsd: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * eBay's Browse API uses a short-lived OAuth token obtained via the
 * client-credentials flow — this is the self-serve "Application" token
 * (instant, no approval needed), not a user-authorized token. Cached
 * in-memory for the process lifetime since a fresh token lookup on every
 * page load would multiply every visitor's request into two.
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) return null;

  try {
    const basic = Buffer.from(`${appId}:${certId}`).toString("base64");
    const res = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[ebay] token request failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    if (typeof data?.access_token !== "string") return null;

    const ttlMs = typeof data.expires_in === "number" ? data.expires_in * 1000 : 2 * 60 * 60 * 1000;
    cachedToken = { token: data.access_token, expiresAt: Date.now() + ttlMs };
    return cachedToken.token;
  } catch {
    return null;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The card being priced — the same fields that make two CardMart listings "the same card". */
export interface MarketCard {
  name: string;
  // "Series — Set" or "Set — Year", e.g. "Neo Genesis — 2000".
  subtitle: string;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  // "215/203", "OP01-120", "TG23/TG30" — when known, the surest way to tell
  // same-named cards apart.
  cardNumber?: string | null;
  // English and Japanese prints of the same card trade at very different
  // prices, so only listings in the card's own language count. Unset means
  // English.
  language?: "ENGLISH" | "JAPANESE" | null;
}

// eBay's "CCG Individual Cards" category — singles only, no sealed product.
const CCG_SINGLES_CATEGORY = "183454";

// How eBay's "Professional Grader" item specific names each company.
const EBAY_GRADER_ASPECT: Record<string, string> = {
  PSA: "Professional Sports Authenticator (PSA)",
  BGS: "Beckett Grading Services (BGS)",
  CGC: "Certified Guaranty Company (CGC)",
};

// Words that identify a grader in a listing title.
const GRADER_WORDS: Record<string, string[]> = {
  PSA: ["psa"],
  BGS: ["bgs", "beckett"],
  CGC: ["cgc"],
  SGC: ["sgc"],
  TAG: ["tag"],
  ACE: ["ace"],
};

const JAPANESE_WORDS = ["japanese", "jpn", "japan", "jp"];
const LANGUAGE_WORDS = ["japanese", "jpn", "japan", "jp", "korean", "kor", "kr", "chinese", "chn", "cn", "thai", "german", "french", "italian", "spanish"];
// Lots, fakes and things that aren't one real card.
const JUNK_WORDS = ["lot", "lots", "bundle", "proxy", "custom", "orica", "reprint", "replica", "fake", "digital", "empty", "case", "pick", "choose"];
// Words in a card name too generic to require in a title.
const NAME_FILLER = new Set(["holo", "rare", "card", "cards", "pokemon", "the", "of", "and", "foil"]);
// Spelled differently between our names and sellers' titles.
const SYNONYMS: Record<string, string> = { alternate: "alt", edition: "ed", "1st": "1st", first: "1st", pokémon: "pokemon", promos: "promo" };

/** Lowercase words, keeping decimals like "9.5" and splitting "PSA10" into "psa 10". */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(psa|bgs|cgc|sgc)(\d)/g, "$1 $2")
    .replace(/(\d)\.(\d)/g, "$1§$2")
    .split(/[^a-z0-9§é]+/)
    .map((w) => w.replace("§", "."))
    .map((w) => SYNONYMS[w] ?? w)
    .filter(Boolean);
}

function gradeLabel(grade: number): string {
  return Number.isInteger(grade) ? grade.toFixed(0) : grade.toFixed(1);
}

/**
 * The part of a card number titles reliably include: the card's own number
 * without leading zeros ("095/203" → "95", "OP01-120" → "120"), or the whole
 * code when it has letters ("TG23/TG30" → "tg23").
 */
const stripZeros = (w: string) => w.replace(/^0+(?=\d)/, "");

function numberKey(cardNumber: string): string | null {
  const parts = words(cardNumber);
  const numeric = parts.find((w) => /^\d+$/.test(w));
  const key = numeric ?? parts[0];
  return key ? stripZeros(key) : null;
}

/** Set-name parts of the subtitle, minus bare years: "Sword & Shield — Evolving Skies" → both; "Neo Genesis — 2000" → "Neo Genesis". */
function setParts(subtitle: string): { text: string; words: string[] }[] {
  return subtitle
    .split(/[—–|]/)
    .map((part) => ({ text: part.trim(), words: words(part).filter((w) => !/^(19|20)\d\d$/.test(w)) }))
    .filter((part) => part.words.length > 0);
}

/**
 * Whether an eBay listing title is the same card in the same condition:
 * every word of the card's name, its set, the same grader with the same
 * grade (or no grader at all for raw), and no other language, edition,
 * Black Label status or lot. Strict on purpose — a short list of real
 * matches is worth more than a long list of look-alikes.
 */
function titleMatches(title: string, card: MarketCard): boolean {
  const t = words(title);
  const has = (w: string) => t.includes(w);
  const own = words(`${card.name} ${card.subtitle}`);

  if (JUNK_WORDS.some(has)) return false;
  const key = card.cardNumber ? numberKey(card.cardNumber) : null;
  if (key && !t.some((w) => stripZeros(w) === key)) return false;
  if (card.language === "JAPANESE") {
    // Sellers almost always say so in the title; one that doesn't is
    // assumed to be the English print.
    if (!JAPANESE_WORDS.some(has)) return false;
    if (LANGUAGE_WORDS.some((w) => has(w) && !JAPANESE_WORDS.includes(w))) return false;
  } else if (LANGUAGE_WORDS.some((w) => has(w) && !own.includes(w))) {
    return false;
  }

  const nameWords = words(card.name).filter((w) => w.length >= 2 && !NAME_FILLER.has(w));
  if (!nameWords.every(has)) return false;
  // The set is the subtitle's last part ("Sword & Shield — Evolving Skies"
  // means Evolving Skies, not any Sword & Shield set). When that's just a
  // set code ("Romance Dawn — OP01"), the set name before it counts too.
  const parts = setParts(card.subtitle);
  const set = parts.at(-1);
  if (set) {
    const isCode = set.words.length === 1 && /^[a-z]{1,4}\d{1,3}$/.test(set.words[0]);
    const accepted = isCode && parts.length > 1 ? [set, parts.at(-2)!] : [set];
    if (!accepted.some((part) => part.words.every(has))) return false;
  }

  // 1st Edition and Unlimited are different cards price-wise.
  const firstEd = own.includes("1st");
  if (firstEd !== has("1st") || (firstEd && has("unlimited"))) return false;
  if (card.isBlackLabel !== (has("black") && has("label"))) return false;

  const ownGrader = card.gradingCompany;
  for (const [grader, names] of Object.entries(GRADER_WORDS)) {
    if (grader !== ownGrader && names.some(has)) return false;
  }
  if (ownGrader === "RAW" || card.grade == null) return !has("graded") && !has("slab");

  // The first number after the grader's name has to be this grade
  // ("PSA 10", "PSA Gem Mint 10", "Beckett 9.5").
  const want = gradeLabel(card.grade);
  const idx = t.findIndex((w) => GRADER_WORDS[ownGrader]?.includes(w));
  if (idx < 0) return false;
  const next = t.slice(idx + 1, idx + 5).find((w) => /^\d+(\.\d)?$/.test(w));
  return next === want;
}

/** Drops prices far outside the middle half (Tukey fences), once there are enough to tell. */
function trimOutliers(prices: number[]): number[] {
  if (prices.length < 5) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor((sorted.length - 1) * p)];
  const iqr = q(0.75) - q(0.25);
  return sorted.filter((p) => p >= q(0.25) - 1.5 * iqr && p <= q(0.75) + 1.5 * iqr);
}

async function searchOnce(card: MarketCard, token: string, useAspects: boolean): Promise<EbayPriceQuote | null> {
  const query = buildMarketQuery(card);
  try {
    const sp = new URLSearchParams({
      q: query,
      filter: "buyingOptions:{FIXED_PRICE}",
      category_ids: CCG_SINGLES_CATEGORY,
      limit: "100",
    });
    // eBay's own item specifics narrow it to the grader + grade (or ungraded)
    // before the title check below; not every seller fills them in, hence
    // the second pass without.
    if (useAspects) {
      const aspect =
        card.gradingCompany === "RAW" || card.grade == null
          ? "Graded:{No}"
          : EBAY_GRADER_ASPECT[card.gradingCompany]
            ? `Grade:{${gradeLabel(card.grade)}},Professional Grader:{${EBAY_GRADER_ASPECT[card.gradingCompany]}}`
            : null;
      const language = `Language:{${card.language === "JAPANESE" ? "Japanese" : "English"}}`;
      if (aspect) sp.set("aspect_filter", `categoryId:${CCG_SINGLES_CATEGORY},${aspect},${language}`);
    }
    const res = await fetch(`${EBAY_BROWSE_BASE}/item_summary/search?${sp.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
      // Shared across every visitor viewing the same card, so prices stay
      // within a few minutes of eBay while a busy page still makes at most
      // one search per card and grade per window — eBay's Browse API allows
      // 5,000 calls a day.
      next: { revalidate: EBAY_CACHE_SECONDS },
    });
    if (!res.ok) {
      console.warn(`[ebay] search failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const items = Array.isArray(data?.itemSummaries) ? (data.itemSummaries as unknown[]) : [];

    const matched: number[] = [];
    for (const item of items) {
      if (typeof item !== "object" || item === null) continue;
      const { price, title } = item as Record<string, unknown>;
      if (typeof title !== "string" || !titleMatches(title, card)) continue;
      if (typeof price !== "object" || price === null) continue;
      const { value, currency } = price as Record<string, unknown>;
      if (currency !== "USD" || typeof value !== "string") continue;
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) matched.push(numeric);
    }

    const prices = trimOutliers(matched);
    if (prices.length === 0) return null;

    return {
      query,
      itemCount: prices.length,
      medianPriceUsd: median(prices),
      lowPriceUsd: Math.min(...prices),
      highPriceUsd: Math.max(...prices),
    };
  } catch {
    return null;
  }
}

/**
 * Best-effort current-asking-price lookup on eBay's Browse API, counting only
 * listings of this exact card in this exact grade (see titleMatches). Returns
 * null whenever eBay isn't configured, the request fails, or nothing matched
 * exactly — it never falls back to other grades or the raw card, so callers
 * should still render ebaySoldListingsUrl as the verifiable reference.
 */
export async function lookupEbayPrice(card: MarketCard): Promise<EbayPriceQuote | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return (await searchOnce(card, token, true)) ?? searchOnce(card, token, false);
}

/**
 * The search for this exact card: name, set, and grader + grade, e.g.
 * "Lugia Holo 1st Edition Neo Genesis PSA 10". Also pre-fills the outside
 * search links (eBay sold, PriceCharting, Beckett).
 */
export function buildMarketQuery(card: MarketCard): string {
  // The last part is the most specific one ("Sword & Shield — Evolving Skies").
  const set = setParts(card.subtitle).at(-1);
  const nameWords = words(card.name);
  const setText = set && !set.words.every((w) => nameWords.includes(w)) ? ` ${set.text}` : "";
  const number = card.cardNumber ? ` ${card.cardNumber}` : "";
  const japanese = card.language === "JAPANESE" ? " Japanese" : "";
  if (card.gradingCompany === "RAW" || card.grade == null) return `${card.name}${setText}${number}${japanese}`;
  const label = card.isBlackLabel ? " Black Label" : "";
  return `${card.name}${setText}${number}${japanese} ${card.gradingCompany} ${gradeLabel(card.grade)}${label}`;
}
