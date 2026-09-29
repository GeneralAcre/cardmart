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

/** How long a seller has, after a sale, to send the card to the warehouse. */
export const SELLER_SHIP_DAYS = 3;

export function sellerShipByDeadline(from = new Date()): Date {
  return new Date(from.getTime() + SELLER_SHIP_DAYS * 24 * 60 * 60 * 1000);
}

// Demo address — swap for the real warehouse before launch.
export const WAREHOUSE_ADDRESS = "CardMart Warehouse (Inbound)\n99 Rama IV Road, Khlong Toei\nBangkok 10110, Thailand";

/** Short code the seller writes on the package so staff can match it to the sale on arrival. */
export function packageReference(inboundPackageId: string): string {
  return `CM-${inboundPackageId.slice(-6).toUpperCase()}`;
}

/** Whole hours left until `deadline` (negative once it has passed). */
export function hoursUntil(deadline: Date): number {
  return Math.floor((deadline.getTime() - Date.now()) / (60 * 60 * 1000));
}

/** Shapes an inbound package for the seller's ship-it card (components/portfolio/ship-to-warehouse.tsx). */
export function toSaleToShip(pkg: {
  id: string;
  status: string;
  shipByDeadline: Date | null;
  sellerCarrier: string | null;
  sellerTrackingNumber: string | null;
  asset: { id: string; name: string };
  escrowTx: { amountThb: number };
}) {
  return {
    id: pkg.id,
    reference: packageReference(pkg.id),
    status: pkg.status as "AWAITING_SELLER_SHIPMENT" | "PENDING_INSPECTION",
    shipByDeadline: pkg.shipByDeadline?.toISOString() ?? null,
    hoursLeft: pkg.shipByDeadline ? hoursUntil(pkg.shipByDeadline) : null,
    sellerCarrier: pkg.sellerCarrier,
    sellerTrackingNumber: pkg.sellerTrackingNumber,
    asset: { id: pkg.asset.id, name: pkg.asset.name },
    amountThb: pkg.escrowTx.amountThb,
  };
}
