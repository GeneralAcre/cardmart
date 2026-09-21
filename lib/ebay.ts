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
    if (!res.ok) return null;

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

async function searchOnce(query: string, token: string): Promise<EbayPriceQuote | null> {
  try {
    const sp = new URLSearchParams({
      q: query,
      filter: "buyingOptions:{FIXED_PRICE}",
      limit: "30",
    });
    const res = await fetch(`${EBAY_BROWSE_BASE}/item_summary/search?${sp.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
      // Shared cache across every visitor searching the same query — keeps
      // this well within eBay's rate limits, same rationale as TCG API.
      next: { revalidate: 21600 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const items = Array.isArray(data?.itemSummaries) ? (data.itemSummaries as unknown[]) : [];

    const prices: number[] = [];
    for (const item of items) {
      if (typeof item !== "object" || item === null) continue;
      const price = (item as Record<string, unknown>).price;
      if (typeof price !== "object" || price === null) continue;
      const { value, currency } = price as Record<string, unknown>;
      if (currency !== "USD" || typeof value !== "string") continue;
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) prices.push(numeric);
    }

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
 * Best-effort current-asking-price lookup on eBay's Browse API. Returns null
 * whenever eBay isn't configured, the request fails, or nothing USD-priced
 * matched — callers should always still render ebaySoldListingsUrl so there
 * is a real, verifiable price reference even with no API key at all.
 *
 * Tries the grade-qualified query first (e.g. "Charizard VMAX PSA 10"), and
 * only if that finds nothing falls back to the bare card name. Sellers don't
 * all format grade info the same way in their listing titles ("PSA10", "PSA
 * Gem Mint 10", no grade at all if they undersell it), so a query that's too
 * specific can genuinely zero out even though real comps exist under a
 * looser search — a real reference for the raw card beats no reference at
 * all, and the returned `query` field always says exactly what matched.
 */
export async function lookupEbayPrice(
  name: string,
  gradingCompany: string,
  grade: number | null,
): Promise<EbayPriceQuote | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const gradedQuery = buildMarketQuery(name, gradingCompany, grade);
  const graded = await searchOnce(gradedQuery, token);
  if (graded) return graded;

  return gradedQuery !== name ? searchOnce(name, token) : null;
}

/**
 * Builds a search query specific enough to find the right comps — a raw
 * card name alone ("Charizard VMAX") pulls in every parallel/print of it,
 * but adding the grading company + grade ("Charizard VMAX PSA 10") narrows
 * eBay's own fuzzy search to the same tier this listing actually is.
 */
export function buildMarketQuery(name: string, gradingCompany: string, grade: number | null): string {
  if (gradingCompany === "RAW" || grade == null) return name;
  const gradeLabel = Number.isInteger(grade) ? grade.toFixed(0) : grade.toFixed(1);
  return `${name} ${gradingCompany} ${gradeLabel}`;
}
