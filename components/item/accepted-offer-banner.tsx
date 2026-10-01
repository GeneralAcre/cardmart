"use client";

import { CheckCircle2 } from "lucide-react";

import { CompletePurchaseButton } from "@/components/item/complete-purchase-button";
import { completeOfferPurchase } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

// Shown on the item page instead of the normal BuyPanel when the current
// viewer has an offer the seller already accepted — they still have to
// actively complete the purchase themselves (a real wallet signature only
// they can provide), same as claiming a won auction.
export function AcceptedOfferBanner({
  offerId,
  amountThb,
  vaulted,
  sellerWalletAddress,
  platformWalletAddress,
}: {
  offerId: string;
  amountThb: number;
  vaulted: boolean;
  sellerWalletAddress: string | null;
  platformWalletAddress: string | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-4 text-success" />
        {t("Your offer of {amount} was accepted", { amount: formatThb(amountThb) })}
      </div>
      <p className="text-muted-foreground text-xs">
        {t("Complete your purchase to lock in this price — it's reserved for you until you do.")}
      </p>
      <CompletePurchaseButton
        priceThb={amountThb}
        vaulted={vaulted}
        sellerWalletAddress={sellerWalletAddress}
        feeTo={platformWalletAddress}
        ctaLabel={t("Complete Purchase — {amount}", { amount: formatThb(amountThb) })}
        dialogTitle={t("Complete Your Purchase")}
        dialogDescription={t("Payment stays protected until the item is verified.")}
        successMessage={t("Purchase complete!")}
        onConfirm={(fulfillmentChoice, escrowLock) => completeOfferPurchase(offerId, fulfillmentChoice, escrowLock)}
      />
    </div>
  );
}
