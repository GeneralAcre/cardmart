"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Truck, Vault, XCircle, XOctagon } from "lucide-react";
import type { InboundPackage, Asset, EscrowTransaction, User } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { warehouseApproveShip, warehouseApproveVault, warehouseReject } from "@/lib/actions";
import { formatGrade, formatThb } from "@/lib/format";
import { extractPsaCertNumber, psaCertUrl } from "@/lib/psa-client";
import { cn } from "@/lib/utils";

export type InboundPackageWithRelations = InboundPackage & {
  asset: Asset;
  escrowTx: EscrowTransaction & { buyer: User; seller: User };
};

function AddressRow({
  label,
  address,
  phone,
}: {
  label: string;
  address: string | null;
  phone: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {address ? (
        <>
          <span>{address}</span>
          <span className="text-muted-foreground text-xs">{phone ?? "No phone on file"}</span>
        </>
      ) : (
        <span className="text-destructive text-xs">No shipping info on file — contact them before dispatch.</span>
      )}
    </div>
  );
}

function MatchRow({
  label,
  declared,
  official,
}: {
  label: string;
  declared: string;
  official: string;
}) {
  const match = declared === official;
  return (
    <div className="grid grid-cols-3 items-center gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{declared}</span>
      <span className={cn("flex items-center gap-1.5 font-mono", !match && "text-destructive font-semibold")}>
        {match ? (
          <CheckCircle2 className="size-3.5 text-emerald-600" />
        ) : (
          <XCircle className="size-3.5" />
        )}
        {official}
      </span>
    </div>
  );
}

export function InspectionDialog({
  pkg,
  open,
  onOpenChange,
}: {
  pkg: InboundPackageWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"ship" | "vault" | "reject" | null>(null);

  const allMatch =
    pkg.declaredSerial === pkg.officialSerial &&
    pkg.declaredGradingCompany === pkg.officialGradingCompany &&
    pkg.declaredGrade === pkg.officialGrade;

  function run(kind: "ship" | "vault" | "reject", fn: () => Promise<void>) {
    setAction(kind);
    startTransition(async () => {
      try {
        await fn();
        toast.success(
          kind === "ship"
            ? "Approved. Shipping label generated and item delivered to buyer."
            : kind === "vault"
              ? "Approved. Item deposited into the platform vault."
              : "Item rejected. Buyer refunded and item returned to seller.",
        );
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed.");
      } finally {
        setAction(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{pkg.asset.name}</DialogTitle>
          <DialogDescription>
            Compare the seller&apos;s declared certificate data against the
            official grading database before releasing escrow.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Buyer</span>
          <span>{pkg.escrowTx.buyer.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Seller</span>
          <span>{pkg.escrowTx.seller.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Escrow Amount</span>
          <span className="font-semibold">{formatThb(pkg.escrowTx.amountThb)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Buyer&apos;s Delivery Choice</span>
          <Badge variant="secondary">
            {pkg.escrowTx.fulfillmentChoice === "SHIP" ? "Ship to Address" : "Keep in Vault"}
          </Badge>
        </div>

        <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-sm">
          {pkg.escrowTx.fulfillmentChoice === "SHIP" && (
            <AddressRow
              label="Ship to Buyer"
              address={pkg.escrowTx.buyer.shippingAddress}
              phone={pkg.escrowTx.buyer.phone}
            />
          )}
          <AddressRow
            label="Return to Seller (if rejected)"
            address={pkg.escrowTx.seller.shippingAddress}
            phone={pkg.escrowTx.seller.phone}
          />
        </div>

        <div className="bg-muted/40 rounded-lg border p-3">
          <div className="grid grid-cols-3 gap-2 border-b pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Field</span>
            <span>Seller Declared</span>
            <span>Official Database</span>
          </div>
          <MatchRow label="Serial" declared={pkg.declaredSerial} official={pkg.officialSerial} />
          <MatchRow
            label="Grading Co."
            declared={pkg.declaredGradingCompany}
            official={pkg.officialGradingCompany}
          />
          <MatchRow
            label="Grade"
            declared={formatGrade(pkg.declaredGrade)}
            official={formatGrade(pkg.officialGrade)}
          />
          {!allMatch && (
            <p className="text-destructive mt-2 flex items-center gap-1.5 text-xs font-medium">
              <XOctagon className="size-3.5" />
              Mismatch detected — recommend rejecting this item.
            </p>
          )}
          {pkg.officialGradingCompany === "PSA" && (
            <a
              href={psaCertUrl(extractPsaCertNumber(pkg.officialSerial))}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-2"
            >
              View cert on PSA <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <DialogFooter className="sm:flex-wrap sm:justify-between gap-2">
          <Button
            variant="destructive"
            onClick={() => run("reject", () => warehouseReject(pkg.id))}
            disabled={pending}
          >
            {pending && action === "reject" ? <Loader2 className="animate-spin" /> : <XOctagon />}
            Reject Item
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={pkg.escrowTx.fulfillmentChoice === "VAULT" ? "default" : "outline"}
              onClick={() => run("vault", () => warehouseApproveVault(pkg.id))}
              disabled={pending}
            >
              {pending && action === "vault" ? <Loader2 className="animate-spin" /> : <Vault />}
              Approve &amp; Deposit to Vault
            </Button>
            <Button
              variant={pkg.escrowTx.fulfillmentChoice === "SHIP" ? "default" : "outline"}
              onClick={() => run("ship", () => warehouseApproveShip(pkg.id))}
              disabled={pending}
            >
              {pending && action === "ship" ? <Loader2 className="animate-spin" /> : <Truck />}
              Approve &amp; Ship to Buyer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
