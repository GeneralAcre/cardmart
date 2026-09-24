"use client";

import { Trophy } from "lucide-react";

import { CompletePurchaseButton } from "@/components/item/complete-purchase-button";
import { claimAuctionWin } from "@/lib/actions";
import { formatThb } from "@/lib/format";

export function ClaimWinButton({
  auctionId,
  amountThb,
  vaulted,
  sellerWalletAddress,
}: {
  auctionId: string;
  amountThb: number;
  vaulted: boolean;
  sellerWalletAddress: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Trophy className="size-4 text-success" />
        You won this auction at {formatThb(amountThb)}
      </div>
      <p className="text-muted-foreground text-xs">
        Complete your purchase to claim it — same protected escrow as any other purchase.
      </p>
      <CompletePurchaseButton
        priceThb={amountThb}
        vaulted={vaulted}
        sellerWalletAddress={sellerWalletAddress}
        ctaLabel={`Claim & Pay — ${formatThb(amountThb)}`}
        dialogTitle="Claim Your Win"
        dialogDescription="Payment stays protected until the item is verified."
        successMessage="Purchase complete — congratulations!"
        onConfirm={(fulfillmentChoice, escrowLock) => claimAuctionWin(auctionId, fulfillmentChoice, escrowLock)}
      />
    </div>
  );
}
