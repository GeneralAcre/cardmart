"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { makeOffer } from "@/lib/actions";
import { formatThb } from "@/lib/format";

// Rendered both on the marketplace card (nested inside the whole-card
// <Link>, hence the preventDefault/stopPropagation on open) and on the item
// detail page, where there's no surrounding link to fight with.
export function MakeOfferButton({
  assetId,
  assetName,
  listPriceThb,
  size = "sm",
  variant = "outline",
  className,
}: {
  assetId: string;
  assetName: string;
  listPriceThb: number | null;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "secondary" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await makeOffer(assetId, Number(amount), message.trim() || undefined);
        toast.success("Offer sent — the seller has been notified.");
        setOpen(false);
        setAmount("");
        setMessage("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not send offer.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <HandCoins /> Make Offer
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Propose a price for {assetName}
              {listPriceThb != null ? ` — listed at ${formatThb(listPriceThb)}` : ""}. The seller can accept or
              decline from their Portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="offer-amount">Your Offer (THB)</Label>
              <Input
                id="offer-amount"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 35000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="offer-message">Message (optional)</Label>
              <Textarea
                id="offer-message"
                placeholder="Anything you'd like the seller to know…"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !amount || Number(amount) < 100}>
              {pending && <Loader2 className="animate-spin" />}
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
