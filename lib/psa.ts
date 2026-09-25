import "server-only";

// Real integration with PSA's public API
// (https://api.psacard.com/publicapi/swagger.json — the live spec, fetched
// and read directly since PSA's prose docs don't list full field names).
// Requires a PSA-issued bearer token (PSA_API_TOKEN) from
// https://www.psacard.com/publicapi. Note: PSA's public API currently has
// NO price guide / pricing endpoint at all — only cert verification
// (cert/GetByCertNumber), cert images (cert/GetImagesByCertNumber), and
// population report (pop/GetPSASpecPopulation) are exposed. There is no
// "PSA price feed" to integrate; population data is the closest real signal
// PSA exposes, so that's what's surfaced here instead.
//
// Also note: having a token does not mean the account has live access — PSA
// returns 403 "Access to this API is limited to approved customers" until
// they approve the account behind the token. lookupPsaCert treats that (and
// any other non-2xx/network failure) as "unavailable", distinct from a
// definitively-invalid cert number, so callers don't block real users on an
// API that simply isn't provisioned yet.
//
// extractPsaCertNumber/psaCertUrl live in lib/psa-client.ts instead of here
// — they're pure string helpers used by client components (e.g. the "View
// on PSA" link), and this file's "server-only" import would break any
// client component that imported anything from it.
export { extractPsaCertNumber, psaCertUrl } from "@/lib/psa-client";

const PSA_API_BASE = "https://api.psacard.com/publicapi";

export function isPsaConfigured(): boolean {
  return Boolean(process.env.PSA_API_TOKEN);
}

function psaHeaders(): HeadersInit {
  return { Authorization: `bearer ${process.env.PSA_API_TOKEN}` };
}

export interface PsaCertData {
  certNumber: string;
  /** PSA's internal spec identifier for this card/variety (not printed on the card). */
  specId: number | null;
  /** The card's number within its set as printed on the card itself, e.g. "247" — the closest thing to a "serial number" a physical card carries. */
  cardNumber: string | null;
  year: string | null;
  brand: string | null;
  category: string | null;
  subject: string | null;
  variety: string | null;
  cardGrade: string | null;
  gradeNumber: number | null;
  gradeDescription: string | null;
  totalPopulation: number | null;
  totalPopulationWithQualifier: number | null;
  populationHigher: number | null;
  itemStatus: string | null;
}

type PsaLookupResult =
  | { ok: true; cert: PsaCertData }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "unavailable" };

function parseGradeNumber(cardGrade: unknown): number | null {
  if (typeof cardGrade !== "string") return null;
  const match = cardGrade.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function toPsaCertData(raw: Record<string, unknown>, fallbackCertNumber: string): PsaCertData {
  return {
    certNumber: String(raw.CertNumber ?? fallbackCertNumber),
    specId: typeof raw.SpecID === "number" ? raw.SpecID : null,
    cardNumber: (raw.CardNumber as string) ?? null,
    year: (raw.Year as string) ?? null,
    brand: (raw.Brand as string) ?? null,
    category: (raw.Category as string) ?? null,
    subject: (raw.Subject as string) ?? null,
    variety: (raw.Variety as string) ?? null,
    cardGrade: (raw.CardGrade as string) ?? null,
    gradeNumber: parseGradeNumber(raw.CardGrade),
    gradeDescription: (raw.GradeDescription as string) ?? null,
    totalPopulation: typeof raw.TotalPopulation === "number" ? raw.TotalPopulation : null,
    totalPopulationWithQualifier:
      typeof raw.TotalPopulationWithQualifier === "number" ? raw.TotalPopulationWithQualifier : null,
    populationHigher: typeof raw.PopulationHigher === "number" ? raw.PopulationHigher : null,
    itemStatus: (raw.ItemStatus as string) ?? null,
  };
}

/**
 * Looks up a certification number against PSA's real public Cert
 * Verification API (GET /cert/GetByCertNumber/{certNumber}). Distinguishes
 * a definitively-invalid cert ("not_found") from any case where PSA simply
 * couldn't be reached or hasn't approved this account for live access
 * ("unavailable") — callers must not treat "unavailable" as proof the cert
 * is fake.
 */
async function fetchPsaCert(certNumber: string): Promise<PsaLookupResult> {
  if (!isPsaConfigured()) return { ok: false, reason: "unavailable" };

  try {
    const res = await fetch(`${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`, {
      headers: psaHeaders(),
      cache: "no-store",
    });

    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) {
      console.warn(`[psa] cert lookup failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return { ok: false, reason: "unavailable" };
    }

    const data = await res.json();
    const psaCert = data?.PSACert;
    if (!psaCert?.CertNumber) return { ok: false, reason: "not_found" };

    return { ok: true, cert: toPsaCertData(psaCert, certNumber) };
  } catch (err) {
    console.warn("[psa] cert lookup network error:", err);
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Convenience wrapper for display-only call sites that just want cert data
 * or nothing — collapses "not_found" and "unavailable" into null. Use
 * fetchPsaCert directly (via verifyPsaCert) wherever the distinction
 * matters, e.g. deciding whether to block a listing.
 */
export async function lookupPsaCert(certNumber: string): Promise<PsaCertData | null> {
  const result = await fetchPsaCert(certNumber);
  return result.ok ? result.cert : null;
}

export { fetchPsaCert as verifyPsaCert };
export type { PsaLookupResult };

/**
 * Population report for a cert's spec (GET /pop/GetPSASpecPopulation/{specID}).
 * Best-effort: returns null on any failure, including an unapproved account.
 */
export async function lookupPsaPopulation(specId: number): Promise<{
  description: string | null;
  total: number | null;
  grade10: number | null;
} | null> {
  if (!isPsaConfigured()) return null;

  try {
    const res = await fetch(`${PSA_API_BASE}/pop/GetPSASpecPopulation/${specId}`, {
      headers: psaHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      description: data?.Description ?? null,
      total: data?.PSAPop?.Total ?? null,
      grade10: data?.PSAPop?.Grade10 ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Cert images (GET /cert/GetImagesByCertNumber/{certNumber}). PSA's swagger
 * doesn't type this response beyond "object", so this reads whatever URL-ish
 * string fields are present rather than assuming exact key names.
 */
export async function lookupPsaCertImages(certNumber: string): Promise<string[]> {
  if (!isPsaConfigured()) return [];

  try {
    const res = await fetch(`${PSA_API_BASE}/cert/GetImagesByCertNumber/${encodeURIComponent(certNumber)}`, {
      headers: psaHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const data = await res.json();
    const values = Array.isArray(data) ? data : Object.values(data ?? {});
    return values.filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
  } catch {
    return [];
  }
}
