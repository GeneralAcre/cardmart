"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, Loader2, Scale, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveDispute } from "@/lib/actions";
import { formatDateTime, formatThb } from "@/lib/format";
import { DISPUTE_REASON_LABELS, DISPUTE_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/shipping";
import { useT } from "@/components/landing/language-provider";

type Person = { id: string; name: string | null; handle: string | null };

export interface DisputeRow {
  id: string;
  reason: keyof typeof DISPUTE_REASON_LABELS;
  description: string;
  status: keyof typeof DISPUTE_STATUS_LABELS;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  openedBy: Person & { email: string | null };
  escrowTx: {
    amountThb: number;
    fulfillmentChoice: "SHIP" | "VAULT";
    releasedAt: string | null;
    onChain: boolean;
    asset: { id: string; name: string; serial: string };
    seller: Person;
    shipment: { status: keyof typeof SHIPMENT_STATUS_LABELS; carrier: string | null; trackingNumber: string | null } | null;
  };
}

const personName = (p: Person) => p.name ?? (p.handle ? `@${p.handle}` : "—");

function OpenDispute({ dispute }: { dispute: DisputeRow }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const t = useT();
  const tx = dispute.escrowTx;

  function resolve(outcome: "refunded" | "no_action") {
    startTransition(async () => {
      try {
        await resolveDispute(dispute.id, outcome, note);
        toast.success(t("Dispute resolved. The buyer was notified."));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not resolve this dispute."));
      }
    });
  }

  return (
    <article className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <Link href={`/item/${tx.asset.id}`} className="font-semibold hover:underline" target="_blank">
            {tx.asset.name}
          </Link>
          <span className="text-muted-foreground font-mono text-xs">{tx.asset.serial}</span>
        </div>
        <Badge>{t(DISPUTE_REASON_LABELS[dispute.reason])}</Badge>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("Buyer")}</dt>
          <dd className="font-medium">{personName(dispute.openedBy)}</dd>
          {dispute.openedBy.email && <dd className="text-muted-foreground truncate">{dispute.openedBy.email}</dd>}
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Seller")}</dt>
          <dd className="font-medium">{personName(tx.seller)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Paid")}</dt>
          <dd className="font-medium">{formatThb(tx.amountThb)}</dd>
          <dd className="text-muted-foreground">{tx.onChain ? t("On-chain escrow") : t("Simulated escrow")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Delivery")}</dt>
          <dd className="font-medium">
            {tx.fulfillmentChoice === "VAULT"
              ? t("Kept in vault")
              : tx.shipment
                ? t(SHIPMENT_STATUS_LABELS[tx.shipment.status])
                : "—"}
          </dd>
          {tx.shipment?.trackingNumber && (
            <dd className="text-muted-foreground font-mono">
              {tx.shipment.carrier} {tx.shipment.trackingNumber}
            </dd>
          )}
        </div>
      </dl>

      <blockquote className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-line">{dispute.description}</blockquote>
      <p className="text-muted-foreground text-xs">
        {t("Reported {date}", { date: formatDateTime(dispute.createdAt) })}
      </p>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Textarea
          rows={2}
          placeholder={t("Note to the buyer: what you found and what happens next")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {t("The escrow was already released, so a refund is paid to the buyer outside the app. Record it here once it's sent.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending || note.trim().length < 5} onClick={() => resolve("refunded")}>
            {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
            {t("Refund issued")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending || note.trim().length < 5} onClick={() => resolve("no_action")}>
            <CircleCheck /> {t("Close without refund")}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function DisputesQueue({ open, resolved }: { open: DisputeRow[]; resolved: DisputeRow[] }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-8">
      {open.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <Scale className="size-8" />
          <p className="text-sm">{t("No open disputes. Buyers can report a problem from the item page after a purchase.")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {open.map((d) => (
            <OpenDispute key={d.id} dispute={d} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("Recently resolved")}</h2>
          <ul className="divide-y rounded-xl border">
            {resolved.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{d.escrowTx.asset.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {personName(d.openedBy)} · {t(DISPUTE_REASON_LABELS[d.reason])} · {d.resolutionNote}
                  </span>
                </div>
                <Badge variant={d.status === "RESOLVED_REFUNDED" ? "default" : "secondary"} className="w-fit">
                  {t(DISPUTE_STATUS_LABELS[d.status])}
                </Badge>
                <span className="text-muted-foreground text-xs">{d.resolvedAt ? formatDateTime(d.resolvedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
