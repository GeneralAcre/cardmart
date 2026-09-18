"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Truck } from "lucide-react";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { submitForGrading } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { StepHeading } from "@/components/verify/step-heading";
import { CATEGORY_GRADING_COMPANIES, CATEGORY_LABELS, GRADING_COMPANY_LABELS } from "@/lib/labels";
import { FULL_SERVICE_COST_BREAKDOWN, FULL_SERVICE_PACKAGE_PRICE_THB } from "@/lib/pricing";

const CATEGORIES: AssetCategory[] = ["TRADING_CARD", "SPORTS_CARD", "COMIC"];

export function FullServiceForm() {
  const router = useRouter();
  const { connected, connecting, connect, signMessage } = useWalletStore();

  const [itemName, setItemName] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [category, setCategory] = useState<AssetCategory>("TRADING_CARD");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const gradingCompanies = CATEGORY_GRADING_COMPANIES[category];

  const [payOpen, setPayOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const canSubmit = itemName.trim().length >= 2 && itemSubtitle.trim().length >= 2;

  async function handleConfirmAndPay() {
    setSigning(true);
    try {
      if (!connected) await connect();
      await signMessage(`Pay ${FULL_SERVICE_PACKAGE_PRICE_THB} THB full-service grading package for ${itemName}`);
      toast.success("Payment signed", { description: `฿${FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()}` });

      const fd = new FormData();
      fd.set("itemName", itemName);
      fd.set("itemSubtitle", itemSubtitle);
      fd.set("category", category);
      fd.set("gradingCompany", gradingCompany);

      startSubmit(async () => {
        const res = await submitForGrading({}, fd);
        if (res.error) {
          toast.error(res.error);
          setPayOpen(false);
          return;
        }
        toast.success("Item submitted. We'll ship it to the grading company shortly.");
        router.push("/portfolio");
      });
    } catch (err) {
      // signMessage/connect now hit the real Privy wallet, which can
      // genuinely fail (rejected, session hiccup, etc.).
      toast.error(err instanceof Error ? err.message : "Signing failed. Try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Full-Service Grading</CardTitle>
          <CardDescription>
            Describe the item as best you can — the grading company will
            determine the official grade once it arrives.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <StepHeading step={1} title="What are you sending in?" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-name">Item Name</Label>
            <Input
              id="item-name"
              placeholder="e.g. Charizard Base Set Holo"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-subtitle">Description / Set / Origin</Label>
            <Textarea
              id="item-subtitle"
              placeholder="e.g. Base Set, 1999, mild edge wear, believed near-mint"
              value={itemSubtitle}
              onChange={(e) => setItemSubtitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  const next = v as AssetCategory;
                  setCategory(next);
                  setGradingCompany(CATEGORY_GRADING_COMPANIES[next][0]); // institute list is category-specific
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Who should grade it?</Label>
              <Select value={gradingCompany} onValueChange={(v) => setGradingCompany(v as GradingCompany)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradingCompanies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {GRADING_COMPANY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <StepHeading step={2} title="Review the cost" />
          <div className="bg-muted/30 flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping to grading company</span>
              <span>฿{FULL_SERVICE_COST_BREAKDOWN.shippingToGraderThb.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grading company fee</span>
              <span>฿{FULL_SERVICE_COST_BREAKDOWN.gradingFeeThb.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Digital certificate creation</span>
              <span>฿{FULL_SERVICE_COST_BREAKDOWN.mintingFeeThb.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>Total package price</span>
              <span>฿{FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()}</span>
            </div>
          </div>

          <Button type="button" size="lg" disabled={!canSubmit} onClick={() => setPayOpen(true)}>
            <Sparkles />
            Pay ฿{FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()} &amp; Submit for Grading
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <Truck className="size-4" />
          What happens next
        </div>
        <ol className="text-muted-foreground flex flex-col gap-3 text-sm">
          <li>1. We arrange pickup/shipping of your raw item to {GRADING_COMPANY_LABELS[gradingCompany]}.</li>
          <li>2. {GRADING_COMPANY_LABELS[gradingCompany]} grades the item and assigns an official certificate.</li>
          <li>3. We create your digital certificate and hand the finished listing to you — ready to price and sell.</li>
        </ol>
        <p className="text-muted-foreground text-xs">
          Track progress anytime from the &quot;Grading Submissions&quot; tab on Portfolio.
        </p>
      </div>

      <Dialog open={payOpen} onOpenChange={(open) => !signing && !submitting && setPayOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay for Full-Service Grading</DialogTitle>
            <DialogDescription>
              You&apos;ll approve this with your crypto wallet. The payment
              itself is simulated for now — real payment processing is
              coming in a future update.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item</span>
              <span>{itemName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package Price</span>
              <span className="font-semibold">฿{FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={signing || submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAndPay} disabled={signing || submitting || connecting}>
              {signing || submitting ? <Loader2 className="animate-spin" /> : null}
              {signing
                ? "Waiting for approval…"
                : submitting
                  ? "Submitting…"
                  : `Confirm & Pay ฿${FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
