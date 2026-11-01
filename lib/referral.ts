// Referrals: everyone's invite link is the landing page with their handle,
// /?ref=<handle>. proxy.ts keeps the handle in a cookie while the visitor
// looks around, and lib/session.ts saves it on their User row the first time
// they sign in. The same link is the QR code on shared profit cards
// (lib/qr.ts draws it).

export const REF_COOKIE = "cm_ref";
/** How long an opened invite link still counts if they sign up later. */
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/** Handles are lowercase letters, numbers and underscores (lib/profile-actions.ts). */
export const REF_HANDLE = /^[a-z0-9_]{1,40}$/;

export function siteUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function referralUrl(handle: string) {
  return `${siteUrl()}/?ref=${encodeURIComponent(handle)}`;
}
