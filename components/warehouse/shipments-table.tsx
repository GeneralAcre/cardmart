"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, PackageOpen, Pencil, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dispatchShipment, markShipmentDelivered } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { COMMON_CARRIERS, SHIPMENT_STATUS_LABELS, trackingUrl } from "@/lib/shipping";
import { useT } from "@/components/landing/language-provider";

export interface ShipmentRow {
  id: string;
  reason: "SALE" | "REDEEM";
  status: "AWAITING_DISPATCH" | "SHIPPED" | "DELIVERED";
  shippingAddress: string;
  phone: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  asset: { id: string; name: string; serial: string };
  recipient: { name: string | null; handle: string | null };
}

const STATUS_VARIANT = {
  AWAITING_DISPATCH: "default",
  SHIPPED: "secondary",
  DELIVERED: "outline",
} as const;

function DispatchDialog({ shipment, onClose }: { shipment: ShipmentRow; onClose: () => void }) {
  const [carrier, setCarrier] = useState(shipment.carrier ?? COMMON_CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState(shipment.trackingNumber ?? "");
  const [pending, startTransition] = useTransition();
  const t = useT();

  function submit() {
    startTransition(async () => {
      try {
        await dispatchShipment(shipment.id, carrier, trackingNumber);
        toast.success(shipment.status === "AWAITING_DISPATCH" ? t("Marked as shipped. The recipient was notified.") : t("Tracking updated."));
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not save tracking."));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shipment.status === "AWAITING_DISPATCH" ? t("Ship this card") : t("Edit tracking")}</DialogTitle>
          <DialogDescription>
            {shipment.asset.name} → {shipment.recipient.name ?? shipment.recipient.handle}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-line">
          {shipment.shippingAddress || t("No address on file")}
          {shipment.phone && <div className="text-muted-foreground mt-1 text-xs">{shipment.phone}</div>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="carrier">{t("Courier")}</Label>
          <Input id="carrier" list="carrier-options" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <datalist id="carrier-options">
            {COMMON_CARRIERS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tracking">{t("Tracking number")}</Label>
          <Input
            id="tracking"
            className="font-mono"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || trackingNumber.trim().length < 4}>
            {pending ? <Loader2 className="animate-spin" /> : <Truck />}
            {shipment.status === "AWAITING_DISPATCH" ? t("Mark as shipped") : t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShipmentTable({ rows, editable }: { rows: ShipmentRow[]; editable: boolean }) {
  const [editing, setEditing] = useState<ShipmentRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useT();

  function deliver(id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await markShipmentDelivered(id);
        toast.success(t("Marked as delivered."));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not update this shipment."));
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Item")}</TableHead>
            <TableHead>{t("Ship to")}</TableHead>
            <TableHead>{t("Tracking")}</TableHead>
            <TableHead>{t("Status")}</TableHead>
            {editable && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const url = trackingUrl(s.carrier, s.trackingNumber);
            return (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{s.asset.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">{s.asset.serial}</span>
                    <span className="text-muted-foreground text-xs">
                      {s.reason === "SALE" ? t("Sale") : t("Vault redemption")} · {formatDateTime(s.createdAt)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="max-w-64">
                  <div className="flex flex-col text-xs">
                    <span className="text-sm font-medium">{s.recipient.name ?? s.recipient.handle}</span>
                    <span className="text-muted-foreground line-clamp-2 whitespace-normal">{s.shippingAddress}</span>
                    {s.phone && <span className="text-muted-foreground">{s.phone}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {s.trackingNumber ? (
                    <div className="flex flex-col text-xs">
                      <span>{s.carrier}</span>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono underline underline-offset-2">
                          {s.trackingNumber} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="font-mono">{s.trackingNumber}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status]}>{t(SHIPMENT_STATUS_LABELS[s.status])}</Badge>
                  {s.deliveredAt && (
                    <div className="text-muted-foreground mt-1 text-xs">{formatDateTime(s.deliveredAt)}</div>
                  )}
                </TableCell>
                {editable && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {s.status === "AWAITING_DISPATCH" ? (
                        <Button size="sm" onClick={() => setEditing(s)}>
                          <Truck /> {t("Ship")}
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={t("Edit tracking")}>
                            <Pencil />
                          </Button>
                          <Button size="sm" variant="outline" disabled={pendingId === s.id} onClick={() => deliver(s.id)}>
                            {pendingId === s.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                            {t("Delivered")}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editing && <DispatchDialog shipment={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function ShipmentsBoard({ open, delivered }: { open: ShipmentRow[]; delivered: ShipmentRow[] }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-8">
      {open.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <PackageOpen className="size-8" />
          <p className="text-sm">{t("Nothing to ship. Approved sales and vault redemptions show up here.")}</p>
        </div>
      ) : (
        <ShipmentTable rows={open} editable />
      )}
      {delivered.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("Recently delivered")}</h2>
          <ShipmentTable rows={delivered} editable={false} />
        </section>
      )}
    </div>
  );
}
