"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeBid } from "@/lib/actions";
import { formatThb } from "@/lib/format";

export function BidPanel({ auctionId, minBid }: { auctionId: string; minBid: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(minBid));
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        const result = await placeBid(auctionId, Number(amount));
        toast.success(result.extended ? "Bid placed — auction extended by 5 minutes." : "Bid placed!");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not place bid.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={minBid}
        />
        <Button onClick={submit} disabled={pending || !amount || Number(amount) < minBid}>
          {pending ? <Loader2 className="animate-spin" /> : <Gavel />}
          Place Bid
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">Minimum bid: {formatThb(minBid)}</p>
      <p className="text-muted-foreground text-xs">Anti-sniping: bids in the final 5 minutes extend the auction by 5 minutes.</p>
    </div>
  );
}
