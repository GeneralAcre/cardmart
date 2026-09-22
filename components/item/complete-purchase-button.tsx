"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Truck, Vault } from "lucide-react";

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
import { useWalletStore } from "@/lib/web3/wallet-store";
import { buildLockPaymentTransaction, randomTradeId } from "@/lib/web3/escrow-program";
import { thbToLamports } from "@/lib/pricing";
import { formatThb } from "@/lib/format";

export type EscrowLock = { tradeId: string; txSignature: string; lamports: string; tradeAccount: string };

// Shared real wallet-signed escrow-lock flow behind buyListing (BuyPanel),
// claimAuctionWin, and completeOfferPurchase — all three end with a buyer
// paying an already-agreed price, so they share this same signing UI rather
// than each re-implementing the connect/sign/lock sequence.
export function CompletePurchaseButton({
  priceThb,
  vaulted,
  sellerWalletAddress,
  ctaLabel,
  dialogTitle,
  dialogDescription,
  successMessage,
  onConfirm,
  size = "lg",
}: {
  priceThb: number;
  vaulted: boolean;
  sellerWalletAddress: string | null;
  ctaLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  successMessage: string;
  onConfirm: (fulfillmentChoice: "SHIP" | "VAULT", escrowLock: EscrowLock | undefined) => Promise<void>;
  size?: "sm" | "default" | "lg";
}) {
  const router = useRouter();
  const { connected, connecting, connect, publicKey, signMessage, signAndSendRawTransaction } = useWalletStore();
  const [fulfillment, setFulfillment] = useState<"SHIP" | "VAULT">("SHIP");
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);

  async function handleConfirm() {
    setSigning(true);
    try {
      if (!connected) await connect();

      let escrowLock: EscrowLock | undefined;
      if (sellerWalletAddress && publicKey) {
        try {
          const tradeId = randomTradeId();
          const lamports = thbToLamports(priceThb);
          const { transactionBytes, tradeAccount } = await buildLockPaymentTransaction({
            buyer: publicKey,
            seller: sellerWalletAddress,
            tradeId,
            lamports,
          });
          const txSignature = await signAndSendRawTransaction(transactionBytes);
          escrowLock = { tradeId: tradeId.toString(), txSignature, lamports: lamports.toString(), tradeAccount };
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not lock in your payment. Try again.");
          return;
        }
      } else {
        await signMessage(`Confirm payment of ${priceThb} THB for this item`);
      }

      try {
        await onConfirm(vaulted ? "VAULT" : fulfillment, escrowLock);
        toast.success(successMessage);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Purchase failed.");
      }
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <ShieldCheck />
        {ctaLabel}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !signing && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {!vaulted && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">How do you want to receive it?</span>
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
            </div>
          )}

          <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{formatThb(priceThb)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span>{vaulted ? "Instant Vault Transfer" : fulfillment === "SHIP" ? "Ship to Address" : "Deposit to Vault"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={signing}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={signing || connecting}>
              {signing ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {signing ? "Waiting for approval…" : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
