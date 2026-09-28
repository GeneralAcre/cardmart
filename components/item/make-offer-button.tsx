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
import { useT } from "@/components/landing/language-provider";

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
  const t = useT();

  function submit() {
    startTransition(async () => {
      try {
        await makeOffer(assetId, Number(amount), message.trim() || undefined);
        toast.success(t("Offer sent — the seller has been notified."));
        setOpen(false);
        setAmount("");
        setMessage("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not send offer."));
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
        <HandCoins /> {t("Make Offer")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t("Make an Offer")}</DialogTitle>
            <DialogDescription>
              {t("Propose a price for {name}", { name: assetName })}
              {listPriceThb != null ? ` — ${t("listed at {price}", { price: formatThb(listPriceThb) })}` : ""}.{" "}
              {t("The seller can accept or decline from their Portfolio.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="offer-amount">{t("Your Offer (THB)")}</Label>
              <Input
                id="offer-amount"
                type="number"
                inputMode="numeric"
                placeholder={t("e.g. 35000")}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="offer-message">{t("Message (optional)")}</Label>
              <Textarea
                id="offer-message"
                placeholder={t("Anything you'd like the seller to know…")}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t("Cancel")}
            </Button>
            <Button onClick={submit} disabled={pending || !amount || Number(amount) < 100}>
              {pending && <Loader2 className="animate-spin" />}
              {t("Send Offer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
