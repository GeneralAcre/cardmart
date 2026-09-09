"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Loader2 } from "lucide-react";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CardArt } from "@/components/asset/card-art";
import { CameraCaptureGrid, type CaptureMap } from "@/components/verify/camera-capture-grid";
import { createListing } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { CATEGORY_GRADING_COMPANIES, CATEGORY_LABELS, GRADING_COMPANY_LABELS } from "@/lib/labels";
import { SELF_MINT_FEE_THB } from "@/lib/pricing";
import { themeIndexForSerial } from "@/lib/theme";
import { getVerificationChecklist } from "@/lib/verification-checklist";

const CATEGORIES: AssetCategory[] = ["TRADING_CARD", "SPORTS_CARD", "AMULET", "COMIC"];

export function SelfMintForm() {
  const router = useRouter();
  const { connected, connecting, publicKey, connect, signMessage } = useWalletStore();

  const [raw, setRaw] = useState(false);
  const [category, setCategory] = useState<AssetCategory>("TRADING_CARD");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const gradingCompanies = CATEGORY_GRADING_COMPANIES[category];
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [grade, setGrade] = useState("");
  const [priceThb, setPriceThb] = useState("");
  const [captures, setCaptures] = useState<CaptureMap>({});

  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const checklist = getVerificationChecklist(category, raw);
  const allCaptured = checklist.every((v) => captures[v.key]);

  function handleModeChange(nextRaw: boolean) {
    setRaw(nextRaw);
    setCaptures({}); // checklist differs between graded and raw — start over
  }

  function handleCategoryChange(next: AssetCategory) {
    setCategory(next);
    setGradingCompany(CATEGORY_GRADING_COMPANIES[next][0]); // institute list is category-specific
    setCaptures({}); // checklist changes per category — start over
  }

  async function handleConfirmAndSign() {
    setSigning(true);
    try {
      let key = publicKey;
      if (!connected) key = await connect();
      await signMessage(raw ? `Register digital twin for ${name}` : `Register digital twin for certificate ${serial}`);
      toast.success("Transaction signed", { description: key ? `${key.slice(0, 4)}…${key.slice(-4)}` : undefined });

      const photos = checklist.map((v) => ({
        viewKey: v.key,
        viewLabel: v.label,
        url: captures[v.key],
      }));

      const fd = new FormData();
      fd.set("name", name);
      fd.set("subtitle", subtitle);
      fd.set("category", category);
      fd.set("raw", String(raw));
      fd.set("gradingCompany", raw ? "RAW" : gradingCompany);
      if (!raw) {
        fd.set("grade", grade);
        fd.set("serial", serial);
      }
      fd.set("priceThb", priceThb);
      fd.set("photos", JSON.stringify(photos));

      startSubmit(async () => {
        const res = await createListing({}, fd);
        if (res.error) {
          toast.error(res.error);
          setSignOpen(false);
          return;
        }
        toast.success("Digital twin minted and listing created.");
        router.push(`/item/${res.assetId}`);
      });
    } finally {
      setSigning(false);
    }
  }

  const canSubmit =
    name.trim().length >= 2 &&
    subtitle.trim().length >= 2 &&
    (raw ||
      (serial.trim().length >= 4 &&
        grade.trim().length > 0 &&
        Number(grade) >= 1 &&
        Number(grade) <= 10)) &&
    priceThb.trim().length > 0 &&
    Number(priceThb) > 0 &&
    allCaptured;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            {raw
              ? "Describe the raw item, then verify it yourself with your camera — no grading company involved."
              : "Enter the certificate details exactly as shown on the slab label, then verify it yourself with your camera."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Item Condition</Label>
            <Tabs value={raw ? "raw" : "graded"} onValueChange={(v) => handleModeChange(v === "raw")}>
              <TabsList className="w-full">
                <TabsTrigger value="graded">Already Graded</TabsTrigger>
                <TabsTrigger value="raw">Raw / Ungraded</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-xs">
              {raw
                ? "No official grading company is involved — you verify it yourself with a live camera checklist."
                : `You hold an official ${gradingCompanies.map((c) => GRADING_COMPANY_LABELS[c]).join(" / ")} certificate and self-declare its details.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => handleCategoryChange(v as AssetCategory)}>
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
            {!raw && (
              <div className="flex flex-col gap-2">
                <Label>Select Grading Institute</Label>
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
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                placeholder="e.g. Charizard VMAX Rainbow Rare"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="subtitle">{raw ? "Set / Origin / Condition" : "Set / Origin"}</Label>
              <Input
                id="subtitle"
                placeholder={raw ? "e.g. Evolving Skies, 2021 — near mint" : "e.g. Evolving Skies, 2021"}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
          </div>

          {!raw && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="serial">Serial Number</Label>
                <Input
                  id="serial"
                  placeholder="e.g. 84920193"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="grade">Grade (1–10)</Label>
                <Input
                  id="grade"
                  type="number"
                  step="0.5"
                  min={1}
                  max={10}
                  placeholder="e.g. 10"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </div>
            </div>
          )}

          <Separator />

          <CameraCaptureGrid category={category} raw={raw} captures={captures} onChange={setCaptures} />

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Listing Price (THB)</Label>
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 45000"
              value={priceThb}
              onChange={(e) => setPriceThb(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Self-Mint package fee</span>
            <span className="font-semibold">฿{SELF_MINT_FEE_THB}</span>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={!canSubmit}
            onClick={() => setSignOpen(true)}
          >
            <BadgeCheck />
            Pay ฿{SELF_MINT_FEE_THB} &amp; Create Listing
          </Button>
          {!allCaptured && (
            <p className="text-muted-foreground text-center text-xs">
              Complete every live capture above to unlock this button.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm font-medium">Digital Twin Preview</span>
        <CardArt
          themeIndex={serial ? themeIndexForSerial(serial) : themeIndexForSerial(name || "preview")}
          category={category}
          gradingCompany={raw ? "RAW" : gradingCompany}
          grade={raw ? null : Number(grade) || null}
          size="lg"
          className={!allCaptured ? "opacity-40 grayscale" : undefined}
        />
        <p className="text-muted-foreground text-xs">
          This artwork represents the registered digital twin, generated from
          your {raw ? "item details" : "certificate details"}.
        </p>
      </div>

      <Dialog open={signOpen} onOpenChange={(open) => !signing && !submitting && setSignOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign to Register Digital Twin</DialogTitle>
            <DialogDescription>
              Phase 2 will route this through a Solana Anchor program. For now,
              this simulates the wallet signature and mint transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{raw ? "Item" : "Certificate"}</span>
              <span className="font-mono">{raw ? name : `${gradingCompany}-${serial}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Listing Price</span>
              <span>{priceThb ? `${Number(priceThb).toLocaleString()} THB` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Self-Mint Fee</span>
              <span>฿{SELF_MINT_FEE_THB}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Live Captures</span>
              <span>{Object.keys(captures).length} / {checklist.length}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)} disabled={signing || submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAndSign} disabled={signing || submitting || connecting}>
              {signing || submitting ? <Loader2 className="animate-spin" /> : null}
              {signing ? "Awaiting signature…" : submitting ? "Minting…" : `Sign & Pay ฿${SELF_MINT_FEE_THB}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
