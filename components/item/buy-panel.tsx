"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Truck, Vault } from "lucide-react";
import type { MarketStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buyListing } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { formatThb } from "@/lib/format";

interface BuyPanelProps {
  assetId: string;
  priceThb: number | null;
  forSale: boolean;
  vaulted: boolean;
  marketStatus: MarketStatus;
  isOwner: boolean;
}

export function BuyPanel({ assetId, priceThb, forSale, vaulted, marketStatus, isOwner }: BuyPanelProps) {
  const router = useRouter();
  const { connected, connecting, connect, signMessage } = useWalletStore();

  const [fulfillment, setFulfillment] = useState<"SHIP" | "VAULT">("SHIP");
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, startSubmit] = useTransition();

  if (isOwner) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        You own this item. Manage it from{" "}
        <a href="/portfolio" className="underline">
          Portfolio
        </a>
        .
      </p>
    );
  }

  if (!forSale || priceThb == null) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {marketStatus === "IN_ESCROW"
          ? "This item is currently locked in escrow with another buyer."
          : "This item is not currently for sale."}
      </p>
    );
  }

  async function handleConfirm() {
    setSigning(true);
    try {
      if (!connected) await connect();
      await signMessage(`Lock ${priceThb} THB in escrow for asset ${assetId}`);
      startSubmit(async () => {
        try {
          await buyListing(assetId, vaulted ? "VAULT" : fulfillment);
          toast.success(
            vaulted
              ? "Purchased! Digital ownership transferred instantly."
              : "Payment locked in escrow. Awaiting warehouse inspection.",
          );
          setOpen(false);
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Purchase failed.");
        }
      });
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {vaulted ? (
        <div className="flex items-start gap-3 rounded-lg border bg-indigo-500/5 p-4 text-sm">
          <Vault className="mt-0.5 size-4 shrink-0 text-indigo-500" />
          <p>
            This item is already stored in our vault. Buying transfers digital
            ownership <strong>instantly</strong>, with zero shipping fees. You
            can redeem the physical item anytime from your vault.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Choose fulfillment</span>
          <Tabs value={fulfillment} onValueChange={(v) => setFulfillment(v as "SHIP" | "VAULT")}>
            <TabsList className="w-full">
              <TabsTrigger value="SHIP">
                <Truck className="size-4" /> Ship to My Address
              </TabsTrigger>
              <TabsTrigger value="VAULT">
                <Vault className="size-4" /> Keep in Vault
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-muted-foreground text-xs">
            {fulfillment === "SHIP"
              ? "After warehouse inspection, the item ships directly to your address."
              : "After warehouse inspection, the item is deposited into the platform vault under your ownership."}
          </p>
        </div>
      )}

      <Button size="lg" onClick={() => setOpen(true)}>
        <ShieldCheck />
        Buy with Escrow Protection — {formatThb(priceThb)}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !signing && !submitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              Your payment is locked in Web2 escrow until the item clears
              warehouse inspection. Phase 2 will settle this on-chain.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{formatThb(priceThb)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fulfillment</span>
              <span>{vaulted ? "Instant Vault Transfer" : fulfillment === "SHIP" ? "Ship to Address" : "Deposit to Vault"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={signing || submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={signing || submitting || connecting}>
              {signing || submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {signing ? "Awaiting signature…" : submitting ? "Processing…" : "Sign & Lock Escrow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
