"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Truck } from "lucide-react";
import type { CardGame, GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepHeading } from "@/components/listing/step-heading";
import { submitForGrading } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { CARD_GAMES, CARD_GAME_LABELS, CATEGORY_GRADING_COMPANIES, GRADING_COMPANY_LABELS } from "@/lib/labels";
import { FULL_SERVICE_COST_BREAKDOWN, FULL_SERVICE_PACKAGE_PRICE_THB } from "@/lib/pricing";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

// Raw cards only go to a real grading company — never "RAW" itself.
const GRADERS = CATEGORY_GRADING_COMPANIES.TRADING_CARD.filter((c) => c !== "RAW");

/**
 * Full-Service package: the seller sends in a raw card, the platform ships
 * it to the grading company, pays their fee and mints the digital twin once
 * it comes back graded (staff side: components/warehouse/grading-queue.tsx).
 */
export function FullServiceForm() {
  const router = useRouter();
  const { connected, connecting, connect, signMessage } = useWalletStore();
  const t = useT();

  const [itemName, setItemName] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [game, setGame] = useState<CardGame>("POKEMON");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");

  const [payOpen, setPayOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const canSubmit = itemName.trim().length >= 2 && itemSubtitle.trim().length >= 2;

  async function handleConfirmAndPay() {
    setSigning(true);
    try {
      if (!connected) await connect();
      await signMessage(`Pay ${FULL_SERVICE_PACKAGE_PRICE_THB} THB full-service grading package for ${itemName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Signing failed. Try again."));
      setSigning(false);
      return;
    }
    setSigning(false);

    const fd = new FormData();
    fd.set("itemName", itemName);
    fd.set("itemSubtitle", itemSubtitle);
    fd.set("game", game);
    fd.set("gradingCompany", gradingCompany);

    startSubmit(async () => {
      const res = await submitForGrading({}, fd);
      if (res.error) {
        toast.error(t(res.error));
        setPayOpen(false);
        return;
      }
      toast.success(t("Card submitted — we'll ship it to the grading company shortly."));
      router.push("/portfolio?tab=grading");
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader>
          <CardTitle>{t("Send a raw card for grading")}</CardTitle>
          <CardDescription>
            {t("Describe the card as best you can — the grading company sets the official grade once it arrives. It comes back to you as a digital-twin listing, ready to price.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <StepHeading step={1} title={t("What are you sending in?")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t("Game")}</Label>
              <Select value={game} onValueChange={(v) => setGame(v as CardGame)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_GAMES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(CARD_GAME_LABELS[g])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("Who should grade it?")}</Label>
              <Select value={gradingCompany} onValueChange={(v) => setGradingCompany(v as GradingCompany)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {GRADING_COMPANY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fs-item-name">{t("Card name")}</Label>
            <Input
              id="fs-item-name"
              placeholder={t("e.g. Charizard Base Set Holo")}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fs-item-subtitle">{t("Set / description")}</Label>
            <Textarea
              id="fs-item-subtitle"
              placeholder={t("e.g. Base Set 1999, light edge wear, believed near-mint")}
              value={itemSubtitle}
              onChange={(e) => setItemSubtitle(e.target.value)}
            />
          </div>

          <StepHeading step={2} title={t("Review the cost")} />
          <div className="bg-muted/30 flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Shipping to grading company")}</span>
              <span>{formatThb(FULL_SERVICE_COST_BREAKDOWN.shippingToGraderThb)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Grading company fee")}</span>
              <span>{formatThb(FULL_SERVICE_COST_BREAKDOWN.gradingFeeThb)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Digital twin minting")}</span>
              <span>{formatThb(FULL_SERVICE_COST_BREAKDOWN.mintingFeeThb)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>{t("Total")}</span>
              <span>{formatThb(FULL_SERVICE_PACKAGE_PRICE_THB)}</span>
            </div>
          </div>

          <Button type="button" size="lg" disabled={!canSubmit} onClick={() => setPayOpen(true)}>
            <Sparkles />
            {t("Pay {price} & submit for grading", { price: formatThb(FULL_SERVICE_PACKAGE_PRICE_THB) })}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <Truck className="size-4" />
          {t("What happens next")}
        </div>
        <ol className="text-muted-foreground flex flex-col gap-3 text-sm">
          <li>1. {t("We ship your raw card to {grader}.", { grader: GRADING_COMPANY_LABELS[gradingCompany] })}</li>
          <li>2. {t("{grader} grades it and issues an official certificate.", { grader: GRADING_COMPANY_LABELS[gradingCompany] })}</li>
          <li>3. {t("We mint its digital twin and hand it back to you, ready to price and sell.")}</li>
        </ol>
        <p className="text-muted-foreground text-xs">{t("Track it any time from the Grading tab on Portfolio.")}</p>
      </div>

      <Dialog open={payOpen} onOpenChange={(open) => !signing && !submitting && setPayOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Pay for Full-Service grading")}</DialogTitle>
            <DialogDescription>
              {t("You'll approve this with your wallet. The payment itself is simulated for now.")}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 flex flex-col gap-1 rounded-lg border p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("Card")}</span>
              <span className="truncate">{itemName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Package price")}</span>
              <span className="font-semibold">{formatThb(FULL_SERVICE_PACKAGE_PRICE_THB)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={signing || submitting}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleConfirmAndPay} disabled={signing || submitting || connecting}>
              {(signing || submitting) && <Loader2 className="animate-spin" />}
              {signing
                ? t("Waiting for approval…")
                : submitting
                  ? t("Submitting…")
                  : t("Confirm & pay {price}", { price: formatThb(FULL_SERVICE_PACKAGE_PRICE_THB) })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
