// Pure helpers safe to import from client components — no "server-only"
// guard, no token access. The actual PSA API call lives in lib/psa.ts.

/**
 * Extracts the raw numeric cert number PSA's API expects from this
 * platform's internal "PSA-12345678" serial format.
 */
export function extractPsaCertNumber(serial: string): string {
  return serial.replace(/^PSA-/i, "");
}

/** Public psacard.com cert page for a given cert number — used for the
 * "View on PSA" link shown to buyers and warehouse staff. */
export function psaCertUrl(certNumber: string): string {
  return `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}`;
}
