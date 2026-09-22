"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, HandCoins, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompletePurchaseButton } from "@/components/item/complete-purchase-button";
import { completeOfferPurchase, respondToOffer, withdrawOffer } from "@/lib/actions";
import { OFFER_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime, formatThb } from "@/lib/format";

interface OfferReceived {
  id: string;
  amountThb: number;
  message: string | null;
  createdAt: Date;
  asset: { id: string; name: string };
  buyer: { name: string | null; handle: string | null };
}

interface OfferMade {
  id: string;
  amountThb: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  createdAt: Date;
  asset: { id: string; name: string; vaulted: boolean };
  seller: { walletAddress: string | null };
}

export function OffersPanel({ received, made }: { received: OfferReceived[]; made: OfferMade[] }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Offers Received ({received.length})</h3>
        {received.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending offers on your listings.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {received.map((offer) => (
              <ReceivedOfferRow key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">My Offers ({made.length})</h3>
        {made.length === 0 ? (
          <p className="text-muted-foreground text-sm">You haven&apos;t made any offers yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {made.map((offer) => (
              <MadeOfferRow key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReceivedOfferRow({ offer }: { offer: OfferReceived }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function respond(action: "accept" | "reject") {
    startTransition(async () => {
      try {
        await respondToOffer(offer.id, action);
        toast.success(action === "accept" ? "Offer accepted." : "Offer declined.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not respond to offer.");
      }
    });
  }

  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex flex-col gap-0.5">
        <Link href={`/item/${offer.asset.id}`} className="text-sm font-semibold hover:underline">
          {offer.asset.name}
        </Link>
        <p className="text-muted-foreground text-xs">
          {offer.buyer.name ?? offer.buyer.handle ?? "A buyer"} offered{" "}
          <span className="font-semibold">{formatThb(offer.amountThb)}</span> — {formatDateTime(offer.createdAt)}
        </p>
        {offer.message && <p className="text-muted-foreground text-xs italic">&quot;{offer.message}&quot;</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => respond("reject")} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <X />}
          Decline
        </Button>
        <Button size="sm" onClick={() => respond("accept")} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          Accept
        </Button>
      </div>
    </div>
  );
}

function MadeOfferRow({ offer }: { offer: OfferMade }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleWithdraw() {
    startTransition(async () => {
      try {
        await withdrawOffer(offer.id);
        toast.success("Offer withdrawn.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not withdraw offer.");
      }
    });
  }

  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex flex-col gap-0.5">
        <Link href={`/item/${offer.asset.id}`} className="text-sm font-semibold hover:underline">
          {offer.asset.name}
        </Link>
        <p className="text-muted-foreground text-xs">
          You offered <span className="font-semibold">{formatThb(offer.amountThb)}</span> —{" "}
          {formatDateTime(offer.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={offer.status === "ACCEPTED" ? "default" : "outline"}>
          <HandCoins className="size-3" /> {OFFER_STATUS_LABELS[offer.status]}
        </Badge>
        {offer.status === "PENDING" && (
          <Button size="sm" variant="outline" onClick={handleWithdraw} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Withdraw
          </Button>
        )}
        {offer.status === "ACCEPTED" && (
          <CompletePurchaseButton
            priceThb={offer.amountThb}
            vaulted={offer.asset.vaulted}
            sellerWalletAddress={offer.seller.walletAddress}
            ctaLabel="Complete Purchase"
            dialogTitle="Complete Your Purchase"
            dialogDescription="Payment stays protected until the item is verified."
            successMessage="Purchase complete!"
            size="sm"
            onConfirm={(fulfillmentChoice, escrowLock) =>
              completeOfferPurchase(offer.id, fulfillmentChoice, escrowLock)
            }
          />
        )}
      </div>
    </div>
  );
}
