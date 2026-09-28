"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeBid } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import { useEscrowLock } from "@/lib/web3/use-escrow-lock";
import { useT } from "@/components/landing/language-provider";

export function BidPanel({
  auctionId,
  minBid,
  sellerWalletAddress,
  myLockedBidThb,
}: {
  auctionId: string;
  minBid: number;
  sellerWalletAddress: string | null;
  /** The viewer's own standing (highest, locked) bid, if they're currently winning. */
  myLockedBidThb: number | null;
}) {
  const router = useRouter();
  const { lock, connecting } = useEscrowLock();
  const t = useT();
  const [amount, setAmount] = useState(String(minBid));
  const [signing, setSigning] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = signing || pending;

  async function submit() {
    const bid = Number(amount);
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
        <Input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={minBid}
          aria-label={t("Bid amount in THB")}
        />
        <Button onClick={submit} disabled={busy || connecting || !amount || Number(amount) < minBid}>
          {busy ? <Loader2 className="animate-spin" /> : <Gavel />}
          {signing ? t("Locking…") : t("Place Bid")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("Minimum bid: {amount}", { amount: formatThb(minBid) })}</p>
      <p className="text-muted-foreground text-xs">
        {t("Your bid amount is locked in escrow when you bid, and returned automatically if someone outbids you. If you win, it pays for the card — no second payment.")}
      </p>
      <p className="text-muted-foreground text-xs">{t("Anti-sniping: bids in the final 5 minutes extend the auction by 5 minutes.")}</p>
    </div>
  );
}
