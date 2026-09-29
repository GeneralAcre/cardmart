"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Loader2, PackageCheck, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markShippedToWarehouse } from "@/lib/actions";
import { formatDateTime, formatThb } from "@/lib/format";
import { COMMON_CARRIERS, WAREHOUSE_ADDRESS } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

export interface SaleToShip {
  id: string;
  reference: string;
  status: "AWAITING_SELLER_SHIPMENT" | "PENDING_INSPECTION";
  shipByDeadline: string | null;
  hoursLeft: number | null;
  sellerCarrier: string | null;
  sellerTrackingNumber: string | null;
  asset: { id: string; name: string };
  amountThb: number;
}

function TrackingForm({ sale, onDone }: { sale: SaleToShip; onDone?: () => void }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(sale.sellerCarrier ?? COMMON_CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState(sale.sellerTrackingNumber ?? "");
  const [pending, startTransition] = useTransition();
  const t = useT();
  const listId = `carriers-${sale.id}`;

  function submit() {
    startTransition(async () => {
      const res = await markShippedToWarehouse(sale.id, carrier, trackingNumber);
      if (res.error) {
        toast.error(t(res.error));
        return;
      }
      toast.success(
        sale.status === "AWAITING_SELLER_SHIPMENT"
          ? t("Marked as shipped. The buyer was notified.")
          : t("Tracking updated."),
      );
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        aria-label={t("Courier")}
        list={listId}
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        className="sm:w-44"
      />
      <datalist id={listId}>
        {COMMON_CARRIERS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Input
        aria-label={t("Tracking number")}
        placeholder={t("Tracking number")}
        className="font-mono sm:flex-1"
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
      />
      <Button onClick={submit} disabled={pending || trackingNumber.trim().length < 4 || carrier.trim().length < 2}>
        {pending ? <Loader2 className="animate-spin" /> : <Truck />}
        {sale.status === "AWAITING_SELLER_SHIPMENT" ? t("I've shipped it") : t("Save")}
      </Button>
    </div>
  );
}

/** One sale the seller has to send in — the steps, the address and the tracking form. */
export function ShipToWarehouseTask({ sale }: { sale: SaleToShip }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const t = useT();

  if (sale.status === "PENDING_INSPECTION") {
    return (
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/item/${sale.asset.id}`} className="text-sm font-semibold hover:underline">
            {sale.asset.name}
          </Link>
          <Badge variant="secondary">
            <PackageCheck /> {t("Shipped — awaiting inspection")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {sale.sellerCarrier} <span className="font-mono">{sale.sellerTrackingNumber}</span> ·{" "}
          {t("You're paid {amount} once it passes inspection.", { amount: formatThb(sale.amountThb) })}
        </p>
        {editing ? (
          <TrackingForm sale={sale} onDone={() => setEditing(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground w-fit text-xs underline underline-offset-2"
          >
            {t("Fix tracking number")}
          </button>
        )}
      </div>
    );
  }

  const urgent = sale.hoursLeft != null && sale.hoursLeft < 24;
  const timeLeft =
    sale.hoursLeft == null
      ? null
      : sale.hoursLeft >= 48
        ? t("{days} days left", { days: Math.floor(sale.hoursLeft / 24) })
        : sale.hoursLeft >= 1
          ? t("{hours}h left", { hours: sale.hoursLeft })
          : t("Less than 1h left");

  function copyAddress() {
    navigator.clipboard.writeText(`${WAREHOUSE_ADDRESS}\nRef: ${sale.reference}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5", urgent ? "border-destructive/60" : "border-highlight/50")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">{t("Sold for {amount}", { amount: formatThb(sale.amountThb) })}</span>
          <Link href={`/item/${sale.asset.id}`} className="font-semibold hover:underline">
            {sale.asset.name}
          </Link>
        </div>
        {timeLeft && (
          <Badge variant={urgent ? "destructive" : "default"} className="shrink-0">
            {timeLeft}
          </Badge>
        )}
      </div>

      <ol className="flex flex-col gap-3 text-sm">
        <li className="flex gap-3">
          <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">1</span>
          <span>{t("Pack the card securely: sleeve or slab case, then bubble wrap in a rigid box.")}</span>
        </li>
        <li className="flex gap-3">
          <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">2</span>
          <span>
            {t("Write this reference on the package:")}{" "}
            <span className="bg-muted rounded px-1.5 py-0.5 font-mono font-semibold">{sale.reference}</span>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">3</span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span>{t("Send it to:")}</span>
            <div className="bg-muted/40 flex items-start justify-between gap-2 rounded-lg p-3">
              <span className="text-xs whitespace-pre-line">{WAREHOUSE_ADDRESS}</span>
              <Button size="sm" variant="ghost" onClick={copyAddress} aria-label={t("Copy address")}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">4</span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span>{t("Add the tracking number:")}</span>
            <TrackingForm sale={sale} />
          </div>
        </li>
      </ol>

      {sale.shipByDeadline && (
        <p className="text-muted-foreground text-xs">
          {t("Ship by {date}. If it isn't shipped by then, the sale is cancelled and the buyer refunded.", {
            date: formatDateTime(sale.shipByDeadline),
          })}
        </p>
      )}
    </div>
  );
}

/** The top-of-Portfolio "you sold something, ship it" list. */
export function SalesToShipPanel({ sales }: { sales: SaleToShip[] }) {
  const t = useT();
  const toShip = sales.filter((s) => s.status === "AWAITING_SELLER_SHIPMENT").length;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="size-4" />
        {toShip > 0 ? t("Ship your sold cards ({count})", { count: toShip }) : t("Sales on their way to inspection")}
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sales.map((s) => (
          <ShipToWarehouseTask key={s.id} sale={s} />
        ))}
      </div>
    </section>
  );
}
