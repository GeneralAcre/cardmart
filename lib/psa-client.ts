// Pure helpers safe to import from client components — no "server-only"
// guard, no token access. The actual PSA API call lives in lib/psa.ts.

/**
 * Extracts the raw numeric cert number PSA's API expects from this
 * platform's internal "PSA-12345678" serial format.
 */
export function extractPsaCertNumber(serial: string): string {
  return serial.replace(/^PSA-/i, "");
}

/** Real PSA cert numbers are all digits — anything else (e.g. demo serials
 * like "OP01121001") has no psacard.com page to link to. */
export function isPsaCertNumber(certNumber: string): boolean {
  return /^\d+$/.test(certNumber);
}

/** Public psacard.com cert page for a given cert number — used for the
 * "View on PSA" link shown to buyers and warehouse staff. */
export function psaCertUrl(certNumber: string): string {
  return `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}`;
}
