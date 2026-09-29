import type { DisputeReason, DisputeStatus, ShipmentStatus } from "@prisma/client";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  AWAITING_DISPATCH: "Awaiting dispatch",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  NOT_RECEIVED: "Never arrived",
  NOT_AS_DESCRIBED: "Not as described",
  DAMAGED: "Arrived damaged",
  OTHER: "Something else",
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Open",
  RESOLVED_REFUNDED: "Refund issued",
  RESOLVED_NO_ACTION: "Closed, no refund",
};

/** Couriers offered in the back office dispatch form. Staff can still type any other name. */
export const COMMON_CARRIERS = ["Thailand Post", "Flash Express", "Kerry Express", "J&T Express", "DHL Express"];

// Only couriers with a stable public tracking-page URL; the rest just show
// the number, which the recipient can paste into the courier's own site.
const TRACKING_URLS: Record<string, (n: string) => string> = {
  "thailand post": (n) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(n)}`,
  "flash express": (n) => `https://www.flashexpress.co.th/fle/tracking?se=${encodeURIComponent(n)}`,
  "dhl express": (n) => `https://www.dhl.com/th-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
};

export function trackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber) return null;
  return TRACKING_URLS[carrier.trim().toLowerCase()]?.(trackingNumber) ?? null;
}

/** How long after a purchase completes the buyer can still report a problem. */
export const DISPUTE_WINDOW_DAYS = 30;

export function isWithinDisputeWindow(releasedAt: Date): boolean {
  return Date.now() - releasedAt.getTime() <= DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
