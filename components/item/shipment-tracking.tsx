import { Check, ExternalLink, Truck } from "lucide-react";
import type { Shipment } from "@prisma/client";

import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/format";
import { trackingUrl } from "@/lib/shipping";
import { cn } from "@/lib/utils";

// Shown only to the shipment's recipient, on the item page: where their card
// is between leaving the warehouse and arriving.
export async function ShipmentTracking({ shipment }: { shipment: Shipment }) {
  const t = await getT();
  const url = trackingUrl(shipment.carrier, shipment.trackingNumber);
  const steps = [
    { label: t("Packing"), at: shipment.createdAt, done: true },
    { label: t("Shipped"), at: shipment.shippedAt, done: shipment.status !== "AWAITING_DISPATCH" },
    { label: t("Delivered"), at: shipment.deliveredAt, done: shipment.status === "DELIVERED" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="size-4" />
        {t("Your shipment")}
      </div>
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((s) => (
          <li key={s.label} className="flex flex-col gap-1.5">
            <span className={cn("h-1 rounded-full", s.done ? "bg-highlight" : "bg-muted")} />
            <span className={cn("flex items-center gap-1 text-xs font-medium", !s.done && "text-muted-foreground")}>
              {s.done && <Check className="size-3" />}
              {s.label}
            </span>
            {s.done && s.at && <span className="text-muted-foreground text-[11px]">{formatDateTime(s.at)}</span>}
          </li>
        ))}
      </ol>
      {shipment.trackingNumber ? (
        <p className="text-sm">
          {shipment.carrier}:{" "}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono underline underline-offset-2">
              {shipment.trackingNumber} <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="font-mono">{shipment.trackingNumber}</span>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">{t("The tracking number appears here once the courier collects the package.")}</p>
      )}
    </div>
  );
}
