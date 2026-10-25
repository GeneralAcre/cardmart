// The grader's own public cert page for a slab, for the "View on PSA / BGS /
// CGC" links shown to buyers and warehouse staff. Pure string helpers, safe in
// client components.
//
// Only PSA has an API (lib/psa.ts). Beckett and CGC have no public API and
// block automated requests, so for them a person checks the cert on the
// grader's site: CGC's page takes the cert number in the URL; Beckett's lookup
// has no per-cert link, so it opens the lookup page and the cert number is
// typed in there.
import type { GradingCompany } from "@prisma/client";

import { extractPsaCertNumber, isPsaCertNumber, psaCertUrl } from "@/lib/psa-client";

export interface CertLookup {
  url: string;
  /** False when the link opens the grader's lookup page rather than this cert's own page. */
  direct: boolean;
}

/** This platform stores serials as "BGS-0012345678"; the grader only knows the number. */
export function certNumberFromSerial(serial: string): string {
  return serial.replace(/^(PSA|BGS|CGC)-/i, "");
}

export function certLookup(company: GradingCompany | null | undefined, serial: string | null | undefined): CertLookup | null {
  if (!serial) return null;
  const cert = certNumberFromSerial(serial);
  // Real cert numbers are all digits; demo serials like "OP01121001" have no page to link to.
  if (!isPsaCertNumber(cert)) return null;
  switch (company) {
    case "PSA":
      return { url: psaCertUrl(extractPsaCertNumber(serial)), direct: true };
    case "CGC":
      return { url: `https://www.cgccards.com/certlookup/${encodeURIComponent(cert)}/`, direct: true };
    case "BGS":
      return { url: "https://www.beckett.com/grading/card-lookup", direct: false };
    default:
      return null;
  }
}
