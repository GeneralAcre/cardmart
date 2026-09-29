import { Check, ExternalLink, Receipt } from "lucide-react";
import type { InboundPackage } from "@prisma/client";

import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatThb } from "@/lib/format";
import { trackingUrl } from "@/lib/shipping";
import { cn } from "@/lib/utils";

type Step = { label: string; detail?: React.ReactNode; state: "done" | "current" | "todo" };

// The buyer's view of a purchase that's still in escrow: paid → seller ships
// → inspection → delivered/vaulted. Once the warehouse approves it, the
// ShipmentTracking card (for ship-to-me orders) takes over.
export async function OrderProgress({
  pkg,
  amountThb,
  fulfillment,
  paidAt,
}: {
  pkg: InboundPackage;
  amountThb: number;
  fulfillment: "SHIP" | "VAULT";
  paidAt: Date;
}) {
  const t = await getT();
  const shipped = pkg.status !== "AWAITING_SELLER_SHIPMENT";
  const url = trackingUrl(pkg.sellerCarrier, pkg.sellerTrackingNumber);

  const steps: Step[] = [
    { label: t("Paid into escrow"), detail: formatDateTime(paidAt), state: "done" },
    {
      label: shipped ? t("Seller shipped") : t("Waiting for the seller to ship"),
      detail: shipped ? (
        pkg.sellerTrackingNumber ? (
          <>
            {pkg.sellerCarrier}{" "}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-mono underline underline-offset-2">
                {pkg.sellerTrackingNumber} <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="font-mono">{pkg.sellerTrackingNumber}</span>
            )}
          </>
        ) : undefined
      ) : pkg.shipByDeadline ? (
        t("By {date}, or you're refunded automatically", { date: formatDateTime(pkg.shipByDeadline) })
      ) : undefined,
      state: shipped ? "done" : "current",
    },
    {
      label: t("Checked at our warehouse"),
      detail: shipped ? t("We match the card to its certificate before paying the seller") : undefined,
      state: shipped ? "current" : "todo",
    },
    { label: fulfillment === "VAULT" ? t("Stored in your vault") : t("Shipped to you"), state: "todo" },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="size-4" />
          {t("Your order")}
        </span>
        <span className="text-muted-foreground text-xs">{formatThb(amountThb)}</span>
      </div>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  s.state === "done" && "bg-highlight text-highlight-foreground border-highlight",
                  s.state === "current" && "border-highlight",
                  s.state === "todo" && "border-muted-foreground/40",
                )}
              >
                {s.state === "done" ? <Check className="size-3" /> : s.state === "current" ? <span className="bg-highlight size-2 rounded-full" /> : null}
              </span>
              {i < steps.length - 1 && <span className={cn("w-px flex-1", s.state === "done" ? "bg-highlight" : "bg-border")} />}
            </div>
            <div className={cn("flex flex-col pb-4", i === steps.length - 1 && "pb-0")}>
              <span className={cn("text-sm", s.state === "todo" ? "text-muted-foreground" : "font-medium")}>{s.label}</span>
              {s.detail && <span className="text-muted-foreground text-xs">{s.detail}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
