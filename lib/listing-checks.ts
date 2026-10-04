import "server-only";
// Server-side checks that a new listing is what it says it is, on top of the
// live-capture checklist, the duplicate-cert check and PSA's grade check in
// createListing. The final word is still the warehouse inspection that every
// sale waits on before escrow releases — these stop the obvious abuse early.

import type { PsaCertData } from "@/lib/psa";

const FILLER = new Set(["holo", "rare", "card", "the", "and", "pokemon", "pokémon", "of", "foil"]);

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9é]+/).filter(Boolean);
}

/** A card number's own number without leading zeros: "215/203" → "215", "OP01-120" → "120", "TG23" → "tg23". */
function numberKey(cardNumber: string): string | null {
  const parts = words(cardNumber);
  const key = parts.find((w) => /^\d+$/.test(w)) ?? parts[0];
  return key ? key.replace(/^0+(?=\d)/, "") : null;
}

/**
 * Whether a real PSA cert is the card being listed — so a genuine cert from a
 * cheap PSA 10 can't be reused to list something valuable. Every meaningful
 * word of PSA's card name ("CHARIZARD-HOLO" → charizard) has to appear in the
 * listing's name or set, and the card number has to agree when both have one.
 * Returns a reason when it doesn't match, or null when it does.
 */
export function psaCertMismatch(
  cert: PsaCertData,
  listing: { name: string; subtitle: string; cardNumber?: string | null },
): string | null {
  const own = new Set(words(`${listing.name} ${listing.subtitle}`));
  const subject = words(cert.subject ?? "").filter((w) => w.length >= 3 && !FILLER.has(w));
  const missing = subject.filter((w) => !own.has(w));
  if (missing.length > 0) {
    return `PSA's records show this cert is "${cert.subject}", which doesn't match the card name you entered.`;
  }
  if (cert.cardNumber && listing.cardNumber && numberKey(cert.cardNumber) !== numberKey(listing.cardNumber)) {
    return `PSA's records show this cert is card #${cert.cardNumber}, not #${listing.cardNumber}.`;
  }
  return null;
}

/**
 * The Blob store host our own uploads land on (from BLOB_READ_WRITE_TOKEN,
 * "vercel_blob_rw_<storeId>_…"), so photo URLs can't point anywhere else.
 */
function ownBlobHost(): string | null {
  const storeId = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

/**
 * Photos have to be fresh uploads to our own storage: no outside image links,
 * and no photo used twice in one listing. (Reuse across listings is checked
 * against the database in createListing.) Returns a reason, or null if fine.
 */
export function photoUrlProblem(urls: string[]): string | null {
  const host = ownBlobHost();
  for (const raw of urls) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return "A verification photo is invalid. Retake it and try again.";
    }
    const ok = url.protocol === "https:" && (host ? url.hostname === host : url.hostname.endsWith(".public.blob.vercel-storage.com"));
    if (!ok) return "Verification photos must be taken with the camera here, not linked from elsewhere.";
  }
  if (new Set(urls).size !== urls.length) return "Each view needs its own photo. Retake the repeated one.";
  return null;
}

/** Whether a URL is an upload to our own Blob store (the same rule as listing photos). */
export function isOwnUploadUrl(raw: string): boolean {
  const host = ownBlobHost();
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (host ? url.hostname === host : url.hostname.endsWith(".public.blob.vercel-storage.com"));
  } catch {
    return false;
  }
}
