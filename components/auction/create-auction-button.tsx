"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { startAuction } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

export interface EligibleAsset {
  id: string;
  name: string;
  subtitle: string;
  priceThb: number | null;
}

// Page-level entry point for starting an auction, alongside the per-item
// "Start Auction" button on each Portfolio card (components/portfolio/
// portfolio-item-card.tsx) — same startAuction call, just with the asset
// picked here instead of implied by which card you're on.
export function CreateAuctionButton({ eligibleAssets }: { eligibleAssets: EligibleAsset[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState(eligibleAssets[0]?.id ?? "");
  const [startPrice, setStartPrice] = useState(eligibleAssets[0]?.priceThb ? String(eligibleAssets[0].priceThb) : "");
  const [durationDays, setDurationDays] = useState("3");
  const [startTime, setStartTime] = useState("");
  const [pending, startTransition] = useTransition();
  const t = useT();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const first = eligibleAssets[0];
      setAssetId(first?.id ?? "");
      setStartPrice(first?.priceThb ? String(first.priceThb) : "");
    }
  }

  function handleAssetChange(id: string) {
    setAssetId(id);
    const asset = eligibleAssets.find((a) => a.id === id);
    setStartPrice(asset?.priceThb ? String(asset.priceThb) : "");
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        await startAuction(
          assetId,
          Number(startPrice),
          Number(durationDays),
          startTime ? new Date(startTime).toISOString() : undefined,
        );
        toast.success(startTime ? t("Auction scheduled.") : t("Auction started."));
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not start auction."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Gavel /> {t("Create Auction")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Start an Auction")}</DialogTitle>
          <DialogDescription>
            {t("Replaces any fixed-price listing on the item you pick. Bidding is separate from the marketplace.")}
          </DialogDescription>
        </DialogHeader>

        {eligibleAssets.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("Nothing in your Portfolio is eligible right now — an item can't already be up for auction or locked in an active sale.")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t("Item")}</Label>
              <Select value={assetId} onValueChange={handleAssetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} — {asset.subtitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-auction-start-price">{t("Starting Price (THB)")}</Label>
              <Input
                id="create-auction-start-price"
                type="number"
                inputMode="numeric"
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("Duration")}</Label>
              <Select value={durationDays} onValueChange={setDurationDays}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("1 day")}</SelectItem>
                  <SelectItem value="3">{t("{days} days", { days: 3 })}</SelectItem>
                  <SelectItem value="7">{t("{days} days", { days: 7 })}</SelectItem>
                  <SelectItem value="14">{t("{days} days", { days: 14 })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-auction-start-time">{t("Start time")}</Label>
              <Input
                id="create-auction-start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                {t("Leave blank to start immediately. You can schedule up to 30 days ahead.")}
              </p>
            </div>
            {eligibleAssets.find((a) => a.id === assetId)?.priceThb != null && (
              <p className="text-muted-foreground text-xs">
                {t("Current listing price:")} {formatThb(eligibleAssets.find((a) => a.id === assetId)!.priceThb!)}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || eligibleAssets.length === 0 || !assetId || !startPrice || Number(startPrice) <= 0}
          >
            {pending && <Loader2 className="animate-spin" />}
            {t("Start Auction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
