import "server-only";

// Real integration with PSA's public Cert Verification API
// (https://www.psacard.com/publicapi/documentation), not a mock. Requires a
// PSA-issued bearer token (PSA_API_TOKEN) — get one by registering at
// https://www.psacard.com/publicapi and agreeing to PSA's API End User
// Agreement. Everything here is a no-op (returns null / skips verification)
// when that token isn't configured, so the app keeps working in demo mode
// until a real token is added — same pattern as Vercel Blob and Privy.
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

export interface PsaCertData {
  certNumber: string;
  subject: string | null;
  brand: string | null;
  variety: string | null;
  yearIssued: string | null;
  category: string | null;
  cardGrade: string | null;
  gradeNumber: number | null;
  imageUrl: string | null;
}

function parseGradeNumber(cardGrade: unknown): number | null {
  if (typeof cardGrade !== "string") return null;
  const match = cardGrade.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

/**
 * Looks up a certification number against PSA's real public Cert
 * Verification API. Returns null if PSA isn't configured, the request
 * fails, or the cert doesn't resolve — callers must treat null as
 * "couldn't verify," not "definitely invalid," since a network hiccup or
 * missing token shouldn't silently block a legitimate sale.
 */
export async function lookupPsaCert(certNumber: string): Promise<PsaCertData | null> {
  if (!isPsaConfigured()) return null;

  try {
    const res = await fetch(
      `${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`,
      {
        headers: { Authorization: `bearer ${process.env.PSA_API_TOKEN}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.IsValidRequest || !data?.PSACert) return null;

    const cert = data.PSACert;
    return {
      certNumber: String(cert.CertNumber ?? certNumber),
      subject: cert.Subject ?? null,
      brand: cert.Brand ?? null,
      variety: cert.Variety ?? null,
      yearIssued: cert.YearIssued ?? null,
      category: cert.Category ?? null,
      cardGrade: cert.CardGrade ?? null,
      gradeNumber: parseGradeNumber(cert.CardGrade),
      imageUrl: cert.ImageURL ?? null,
    };
  } catch {
    return null;
  }
}
