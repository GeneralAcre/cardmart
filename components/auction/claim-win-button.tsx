"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, Trophy, Truck, Vault } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompletePurchaseButton } from "@/components/item/complete-purchase-button";
import { claimAuctionWin } from "@/lib/actions";
import { formatDateTime, formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

export function ClaimWinButton({
  auctionId,
  amountThb,
  vaulted,
  locked,
  claimDeadline,
  sellerWalletAddress,
}: {
  auctionId: string;
  amountThb: number;
  vaulted: boolean;
  /** Whether the winning bid already holds its funds in escrow. */
  locked: boolean;
  claimDeadline: string | null;
  sellerWalletAddress: string | null;
}) {
  const t = useT();
  return (
    <div className="border-success/30 bg-success/5 flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Trophy className="text-success size-4" />
        {t("You won this auction at {amount}", { amount: formatThb(amountThb) })}
      </div>
      {locked ? (
        vaulted ? (
          <p className="text-muted-foreground text-xs">{t("Your locked bid is paying for it now — ownership moves to you in the vault.")}</p>
        ) : (
          <ChooseDelivery auctionId={auctionId} claimDeadline={claimDeadline} />
        )
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {claimDeadline
              ? t("This bid was placed before bids locked funds, so complete payment to claim it by {deadline} — otherwise the win lapses.", { deadline: formatDateTime(claimDeadline) })
              : t("This bid was placed before bids locked funds, so complete payment to claim it — otherwise the win lapses.")}
          </p>
          <CompletePurchaseButton
            priceThb={amountThb}
            vaulted={vaulted}
            sellerWalletAddress={sellerWalletAddress}
            ctaLabel={t("Claim & Pay — {amount}", { amount: formatThb(amountThb) })}
            dialogTitle={t("Claim Your Win")}
            dialogDescription={t("Payment stays protected until the item is verified.")}
            successMessage={t("Purchase complete — congratulations!")}
            onConfirm={(fulfillmentChoice, escrowLock) => claimAuctionWin(auctionId, fulfillmentChoice, escrowLock)}
          />
        </>
      )}
    </div>
  );
}

function ChooseDelivery({ auctionId, claimDeadline }: { auctionId: string; claimDeadline: string | null }) {
  const router = useRouter();
  const [choice, setChoice] = useState<"SHIP" | "VAULT">("SHIP");
  const [pending, startTransition] = useTransition();
  const t = useT();

  function confirm() {
    startTransition(async () => {
      try {
        await claimAuctionWin(auctionId, choice);
        toast.success(choice === "SHIP" ? t("Confirmed — it ships once inspection passes.") : t("Confirmed — it goes into the vault for you."));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not confirm delivery."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <Lock className="mt-0.5 size-3 shrink-0" />
        <span>
          {claimDeadline
            ? t("Your payment is already locked in escrow. Choose how to receive it by {deadline} — if you don't, it goes into the vault for you.", { deadline: formatDateTime(claimDeadline) })
            : t("Your payment is already locked in escrow. Choose how to receive it — if you don't, it goes into the vault for you.")}
        </span>
      </p>
      <Tabs value={choice} onValueChange={(v) => setChoice(v as "SHIP" | "VAULT")}>
        <TabsList className="w-full">
          <TabsTrigger value="SHIP">
            <Truck className="size-4" /> {t("Ship to me")}
          </TabsTrigger>
          <TabsTrigger value="VAULT">
            <Vault className="size-4" /> {t("Keep in vault")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button onClick={confirm} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t("Confirm delivery")}
      </Button>
    </div>
  );
}
