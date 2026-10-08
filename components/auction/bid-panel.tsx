"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, Loader2, Lock, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { placeBid } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import { useEscrowLock } from "@/lib/web3/use-escrow-lock";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

// Quick picks, in steps above the minimum.
const QUICK_STEPS = [1, 2, 5];

export function BidPanel({
  auctionId,
  minBid,
  step,
  sellerWalletAddress,
  myLockedBidThb,
}: {
  auctionId: string;
  minBid: number;
  /** Bids move in this many THB (lib/auction-rules.ts); there's no free typing. */
  step: number;
  sellerWalletAddress: string | null;
  /** The viewer's own standing (highest, locked) bid, if they're currently winning. */
  myLockedBidThb: number | null;
}) {
  const router = useRouter();
  const { lock, connecting } = useEscrowLock();
  const t = useT();
  // Steps above the minimum, not an amount: when a new bid raises the
  // minimum (router.refresh), the offer moves up with it instead of going stale.
  const [steps, setSteps] = useState(0);
  const amount = minBid + steps * step;
  const [signing, setSigning] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = signing || pending;

  async function submit() {
    const bid = amount;
    setSigning(true);
    let bidLock;
    try {
      // The full bid is locked first — the server refunds it if the bid is
      // rejected, and again automatically if someone outbids it.
      bidLock = await lock(bid, sellerWalletAddress, `Confirm a bid of ${bid} THB`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Could not lock your bid. Try again."));
      return;
    } finally {
      setSigning(false);
    }
    startTransition(async () => {
      try {
        const result = await placeBid(auctionId, bid, bidLock);
        toast.success(result.extended ? t("Bid placed — auction extended by 5 minutes.") : t("Bid placed and locked in escrow."));
        setSteps(0);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not place bid."));
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {myLockedBidThb != null && (
        <p className="border-success/30 bg-success/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
          <Lock className="text-success size-3.5" />
          {t("You're the highest bidder — {amount} is locked in escrow.", { amount: formatThb(myLockedBidThb) })}
        </p>
      )}
      <div className="flex gap-2">
        <div className="bg-background flex h-11 flex-1 items-center rounded-md border">
          <button
            type="button"
            onClick={() => setSteps((s) => Math.max(0, s - 1))}
            disabled={busy || steps === 0}
            aria-label={t("Lower bid by {amount}", { amount: formatThb(step) })}
            className="text-muted-foreground hover:text-foreground flex h-full w-11 items-center justify-center disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <output aria-label={t("Bid amount in THB")} aria-live="polite" className="flex-1 text-center text-lg font-semibold tabular-nums">
            {formatThb(amount)}
          </output>
          <button
            type="button"
            onClick={() => setSteps((s) => s + 1)}
            disabled={busy}
            aria-label={t("Raise bid by {amount}", { amount: formatThb(step) })}
            className="text-muted-foreground hover:text-foreground flex h-full w-11 items-center justify-center disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <Button onClick={submit} disabled={busy || connecting} className="h-11">
          {busy ? <Loader2 className="animate-spin" /> : <Gavel />}
          {signing ? t("Locking…") : t("Place Bid")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSteps(0)}
          disabled={busy}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            steps === 0 ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("Minimum")} {formatThb(minBid)}
        </button>
        {QUICK_STEPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setSteps(n)}
            disabled={busy}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors",
              steps === n ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            +{formatThb(n * step)}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {t("Minimum bid: {amount}", { amount: formatThb(minBid) })} · {t("Bids go up in steps of {step}.", { step: formatThb(step) })}
      </p>
      <p className="text-muted-foreground text-xs">
        {t("Your bid amount is locked in escrow when you bid, and returned automatically if someone outbids you. If you win, it pays for the card — no second payment.")}
      </p>
      <p className="text-muted-foreground text-xs">{t("Anti-sniping: bids in the final 5 minutes extend the auction by 5 minutes.")}</p>
    </div>
  );
}
