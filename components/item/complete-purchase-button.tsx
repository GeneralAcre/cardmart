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
import { useEscrowLock, type EscrowLock } from "@/lib/web3/use-escrow-lock";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";
import { BUYER_FEE_PERCENT, buyerFeeThb } from "@/lib/pricing";

export type { EscrowLock };

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
  feeTo,
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
  /** The platform wallet — when set, the buyer-protection fee is charged in the same payment. */
  feeTo?: string | null;
}) {
  const router = useRouter();
  const { lock, connecting } = useEscrowLock();
  const t = useT();
  const [fulfillment, setFulfillment] = useState<"SHIP" | "VAULT">("SHIP");
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);

  async function handleConfirm() {
    setSigning(true);
    try {
      let escrowLock: EscrowLock | undefined;
      try {
        escrowLock = await lock(priceThb, sellerWalletAddress, `Confirm payment of ${priceThb} THB for this item`, feeTo);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not lock in your payment. Try again."));
        return;
      }

      try {
        await onConfirm(vaulted ? "VAULT" : fulfillment, escrowLock);
        toast.success(successMessage);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Purchase failed."));
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
              <span className="text-sm font-medium">{t("How do you want to receive it?")}</span>
              <Tabs value={fulfillment} onValueChange={(v) => setFulfillment(v as "SHIP" | "VAULT")}>
                <TabsList className="w-full">
                  <TabsTrigger value="SHIP">
                    <Truck className="size-4" /> {t("Ship to My Address")}
                  </TabsTrigger>
                  <TabsTrigger value="VAULT">
                    <Vault className="size-4" /> {t("Keep in Vault")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <PriceRows priceThb={priceThb} withFee={feeTo !== undefined} />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Delivery")}</span>
              <span>{t(vaulted ? "Instant Vault Transfer" : fulfillment === "SHIP" ? "Ship to Address" : "Deposit to Vault")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={signing}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={signing || connecting}>
              {signing ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {signing ? t("Waiting for approval…") : t("Confirm & Pay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Price, the buyer-protection fee and the total, for the checkout dialogs. */
export function PriceRows({ priceThb, withFee }: { priceThb: number; withFee: boolean }) {
  const t = useT();
  const fee = withFee ? buyerFeeThb(priceThb) : 0;
  return (
    <>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t("Price")}</span>
        <span>{formatThb(priceThb)}</span>
      </div>
      {withFee && (
        <div className="flex justify-between">
          <span className="text-muted-foreground" title={t("Covers escrow and our inspection of the card. Refunded if the sale is cancelled.")}>
            {t("Buyer protection ({percent}%)", { percent: BUYER_FEE_PERCENT })}
          </span>
          <span>{formatThb(fee)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-2">
        <span className="font-medium">{t("Total")}</span>
        <span className="font-semibold">{formatThb(priceThb + fee)}</span>
      </div>
    </>
  );
}
