import "server-only";
import type { NotificationType } from "@prisma/client";

// Transactional email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)
// — plain fetch, no SDK. Mirrors the in-app notification a user just got, so
// email is never the only record of anything. Without RESEND_API_KEY every
// send is a silent no-op, same degrade-gracefully rule as the other
// integrations (PSA, eBay, TCG API).

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function siteUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// Notifications worth an email — things someone would want to know while
// away from the site. Price-drop and wanted-card alerts stay in-app only,
// since they can fire often.
export const EMAILED_NOTIFICATION_TYPES = new Set<NotificationType>([
  "ITEM_SOLD",
  "ITEM_PURCHASED",
  "INSPECTION_PASSED",
  "GRADING_COMPLETE",
  "OUTBID",
  "AUCTION_WON",
  "AUCTION_ENDED_SELLER",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "TRADE_OFFER_RECEIVED",
  "TRADE_OFFER_ACCEPTED",
  "TRADE_OFFER_REJECTED",
  "KYC_APPROVED",
  "KYC_REJECTED",
  "SHIPMENT_DISPATCHED",
  "SHIPMENT_DELIVERED",
  "DISPUTE_RESOLVED",
]);

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(title: string, body: string, href?: string) {
  const link = href ? new URL(href, siteUrl()).toString() : siteUrl();
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,Segoe UI,Roboto,'Noto Sans Thai',sans-serif;color:#111">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<tr><td style="font-size:13px;font-weight:600;letter-spacing:.04em;color:#666">CARDMART</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:600">${escapeHtml(title)}</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333">${escapeHtml(body)}</td></tr>
<tr><td style="padding-top:24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">Open CardMart</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#888">You're getting this because of activity on your CardMart account.</td></tr>
</table></body></html>`;
  const text = `${title}\n\n${body}\n\n${link}`;
  return { html, text };
}

/** Sends one email. Never throws — a failed email must not fail the action that triggered it. */
export async function sendEmail(to: string, title: string, body: string, href?: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;
  const from = process.env.EMAIL_FROM?.trim() || "CardMart <onboarding@resend.dev>";
  const { html, text } = render(title, body, href);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: title, html, text }),
      cache: "no-store",
    });
    if (!res.ok) console.error(`Resend rejected email (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.error("Resend email failed:", err);
  }
}
