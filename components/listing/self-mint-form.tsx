"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, Loader2, SearchX } from "lucide-react";
import type { AssetCategory, CardGame, CardLanguage, GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CameraCaptureGrid, type CaptureMap } from "@/components/listing/camera-capture-grid";
import { StepHeading } from "@/components/listing/step-heading";
import { confirmListingApproval, createListing, lookupPsaCertForForm, type PsaCertLookupResult } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import {
  BGS_BLACK_LABEL_GRADE,
  CATEGORY_GRADING_COMPANIES,
  CARD_GAMES,
  CARD_GAME_LABELS,
  CARD_LANGUAGES,
  CARD_LANGUAGE_LABELS,
  GRADING_COMPANY_LABELS,
  gradeTierLabel,
} from "@/lib/labels";
import { themeIndexForSerial } from "@/lib/theme";
import { getVerificationChecklist } from "@/lib/verification-checklist";
import { useT } from "@/components/landing/language-provider";

// CardMart only trades Pokémon and One Piece cards — both are trading cards,
// which drives the grading companies and camera checklist below.
const CATEGORY: AssetCategory = "TRADING_CARD";

export function SelfMintForm({ escrowAuthorityAddress }: { escrowAuthorityAddress: string | null }) {
  const router = useRouter();
  const { connected, connecting, connect, approveDelegate } = useWalletStore();
  const t = useT();

  const [raw, setRaw] = useState(false);
  const category = CATEGORY;
  const [game, setGame] = useState<CardGame>("POKEMON");
  const [language, setLanguage] = useState<CardLanguage>("ENGLISH");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const gradingCompanies = CATEGORY_GRADING_COMPANIES[category];
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [grade, setGrade] = useState("");
  // BGS Black Label only applies at grade 10 — shown as a checkbox right
  // next to the grade field instead of a separate select option, since it's
  // otherwise indistinguishable from a regular BGS Pristine 10.
  const [isBlackLabel, setIsBlackLabel] = useState(false);
  const showBlackLabelOption = gradingCompany === "BGS" && Number(grade) === BGS_BLACK_LABEL_GRADE;
  const gradeTier = !raw ? gradeTierLabel(gradingCompany, Number(grade) || null, isBlackLabel) : null;
  const [priceThb, setPriceThb] = useState("");
  const [captures, setCaptures] = useState<CaptureMap>({});

  const [signOpen, setSignOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const [psaLookup, setPsaLookup] = useState<PsaCertLookupResult | null>(null);
  // The serial the current psaLookup result actually reflects — compared
  // against the live serial below to derive "pending" instead of tracking
  // it as separate state, so there's no synchronous setState in the effect.
  const [psaLookupSerial, setPsaLookupSerial] = useState("");
  const autofilledRef = useRef({ name: false, subtitle: false, grade: false, cardNumber: false });

  const psaEligible = !raw && gradingCompany === "PSA" && serial.trim().length >= 4;
  const psaLookupPending = psaEligible && psaLookupSerial !== serial.trim();

  // Live PSA lookup as the user types a cert number — debounced so it
  // doesn't fire on every keystroke, and guarded against stale responses
  // landing after the serial has already changed again.
  useEffect(() => {
    if (!psaEligible) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await lookupPsaCertForForm(serial);
      if (cancelled) return;
      setPsaLookup(result);
      setPsaLookupSerial(serial.trim());

      if (result.status === "ok" && result.cert) {
        const cert = result.cert;
        if (!autofilledRef.current.name && cert.subject) {
          setName(cert.subject);
          autofilledRef.current.name = true;
        }
        if (!autofilledRef.current.subtitle && (cert.year || cert.brand || cert.variety)) {
          setSubtitle([cert.year, cert.brand, cert.variety].filter(Boolean).join(" "));
          autofilledRef.current.subtitle = true;
        }
        if (!autofilledRef.current.cardNumber && cert.cardNumber) {
          setCardNumber(cert.cardNumber);
          autofilledRef.current.cardNumber = true;
        }
        if (!autofilledRef.current.grade && cert.gradeNumber != null) {
          setGrade(String(cert.gradeNumber));
          autofilledRef.current.grade = true;
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serial, psaEligible]);

  const checklist = getVerificationChecklist(category, raw);
  const allCaptured = checklist.every((v) => captures[v.key]);

  function handleModeChange(nextRaw: boolean) {
    setRaw(nextRaw);
    setCaptures({}); // checklist differs between graded and raw — start over
  }

  // Both games share the trading-card checklist and grading companies, so
  // switching game keeps whatever the seller has already filled in.
  function handleGameChange(next: CardGame) {
    setGame(next);
  }

  function handleConfirmAndSign() {
    startSubmit(async () => {
      try {
        const photos = checklist.map((v) => ({
          viewKey: v.key,
          viewLabel: v.label,
          url: captures[v.key],
        }));

        const fd = new FormData();
        fd.set("name", name);
        fd.set("subtitle", subtitle);
        if (cardNumber.trim()) fd.set("cardNumber", cardNumber.trim());
        fd.set("category", category);
        fd.set("game", game);
        fd.set("language", language);
        fd.set("raw", String(raw));
        fd.set("gradingCompany", raw ? "RAW" : gradingCompany);
        if (!raw) {
          fd.set("grade", grade);
          fd.set("serial", serial);
          if (showBlackLabelOption) fd.set("isBlackLabel", String(isBlackLabel));
        }
        fd.set("priceThb", priceThb);
        fd.set("photos", JSON.stringify(photos));

        // Minting itself is server-side now (see lib/actions.ts::createListing)
        // — no wallet needed just to create the listing.
        const res = await createListing({}, fd);
        if (res.error) {
          toast.error(t(res.error));
          setSignOpen(false);
          return;
        }

        // A real digital-twin token now exists. One owner-signed Approve
        // delegates the platform to actually move it if this sells later —
        // best-effort: a rejected/failed signature here doesn't block the
        // listing, it just means a future sale falls back to the simulated
        // transfer (see lib/actions.ts::transferOwnership).
        if (res.mintAddress && escrowAuthorityAddress) {
          try {
            if (!connected) await connect();
            const approveTxSignature = await approveDelegate(res.mintAddress, escrowAuthorityAddress);
            await confirmListingApproval(res.assetId!, approveTxSignature);
          } catch (err) {
            toast.warning(t("Listed — but approving the transfer failed. You can retry this from your Portfolio."), {
              description: err instanceof Error ? err.message : undefined,
            });
          }
        }

        // Land on the new listing itself, so the seller sees exactly what buyers will.
        toast.success(t("Listing published on the marketplace."));
        router.push(`/item/${res.assetId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not create the listing. Try again."));
      }
    });
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
          <CardTitle>{t("Listing")}</CardTitle>
          <CardDescription>
            {raw
              ? t("Describe the item, then prove you have it with a quick camera check.")
              : t("Tell us what's on the certificate, then prove you have it with a quick camera check.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <StepHeading step={1} title={t("What are you listing?")} />
          <div className="flex flex-col gap-2">
            <Label>{t("Item Condition")}</Label>
            <Tabs value={raw ? "raw" : "graded"} onValueChange={(v) => handleModeChange(v === "raw")}>
              <TabsList className="w-full">
                <TabsTrigger value="graded">{t("Already Graded")}</TabsTrigger>
                <TabsTrigger value="raw">{t("Raw / Ungraded")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-xs">
              {raw
                ? t("No official grading company is involved — show the item with a live camera checklist, then set your price.")
                : t("You hold an official {companies} certificate and self-declare its details.", {
                    companies: gradingCompanies.map((c) => GRADING_COMPANY_LABELS[c]).join(" / "),
                  })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t("Game")}</Label>
              <Select value={game} onValueChange={(v) => handleGameChange(v as CardGame)}>
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
              <Label>{t("Card language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as CardLanguage)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(CARD_LANGUAGE_LABELS[l])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!raw && (
              <div className="flex flex-col gap-2">
                <Label>{t("Who graded it?")}</Label>
                <Select
                  value={gradingCompany}
                  onValueChange={(v) => {
                    setGradingCompany(v as GradingCompany);
                    if (v !== "BGS") setIsBlackLabel(false);
                  }}
                >
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("Item Name")}</Label>
              <Input
                id="name"
                placeholder={t("e.g. Charizard VMAX Rainbow Rare")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="subtitle">{raw ? t("Set / Origin / Condition") : t("Set / Origin")}</Label>
              <Input
                id="subtitle"
                placeholder={raw ? t("e.g. Evolving Skies, 2021 — near mint") : t("e.g. Evolving Skies, 2021")}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="cardNumber">
                {t("Card number")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
              </Label>
              <Input
                id="cardNumber"
                className="sm:max-w-56"
                placeholder={t("e.g. 215/203 or OP01-120")}
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
              />
              <span className="text-muted-foreground text-xs">
                {t("Printed at the bottom of the card. Helps buyers find it — leave blank and we'll look it up.")}
              </span>
            </div>
          </div>

          {!raw && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="serial">{t("Serial Number")}</Label>
                <Input
                  id="serial"
                  placeholder={t("e.g. 84920193")}
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="grade">{t("Grade (1–10)")}</Label>
                <Input
                  id="grade"
                  type="number"
                  step="0.5"
                  min={1}
                  max={10}
                  placeholder={t("e.g. 10")}
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                    if (Number(e.target.value) !== BGS_BLACK_LABEL_GRADE) setIsBlackLabel(false);
                  }}
                />
                {gradeTier && <p className="text-muted-foreground text-xs">{gradeTier}</p>}
                {showBlackLabelOption && (
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isBlackLabel}
                      onCheckedChange={(checked) => setIsBlackLabel(checked === true)}
                    />
                    {t("Black Label (every sub-grade a perfect 10)")}
                  </label>
                )}
              </div>
            </div>
          )}

          {psaEligible && <PsaLookupPanel pending={psaLookupPending} result={psaLookup} />}

          <Separator />

          <StepHeading step={2} title={t("Prove it's really yours")} />
          <CameraCaptureGrid category={category} raw={raw} captures={captures} onChange={setCaptures} />

          <Separator />

          <StepHeading step={3} title={t("Set your price")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">{t("Listing Price (THB)")}</Label>
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              placeholder={t("e.g. 45000")}
              value={priceThb}
              onChange={(e) => setPriceThb(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t("This is what buyers will see on the marketplace. You can change it anytime.")}
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={!canSubmit}
            onClick={() => setSignOpen(true)}
          >
            <BadgeCheck />
            {t("Create Listing")}
          </Button>
          {!allCaptured && (
            <p className="text-muted-foreground text-center text-xs">
              {t("Complete every live capture above to unlock this button.")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm font-medium">{t("Digital Certificate Preview")}</span>
        <CardArt
          themeIndex={serial ? themeIndexForSerial(serial) : themeIndexForSerial(name || "preview")}
          category={category}
          gradingCompany={raw ? "RAW" : gradingCompany}
          grade={raw ? null : Number(grade) || null}
          isBlackLabel={!raw && showBlackLabelOption && isBlackLabel}
          size="lg"
          className={!allCaptured ? "opacity-40 grayscale" : undefined}
        />
        <p className="text-muted-foreground text-xs">
          {raw
            ? t("This artwork represents your digital certificate, generated from your item details.")
            : t("This artwork represents your digital certificate, generated from your certificate details.")}
        </p>
      </div>

      <Dialog open={signOpen} onOpenChange={(open) => !submitting && setSignOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm Your Listing")}</DialogTitle>
            <DialogDescription>
              {t("Review your item and listing price. Your item will appear on the marketplace after you create the listing.")}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{raw ? t("Item") : t("Certificate")}</span>
              <span className="font-mono">{raw ? name : `${gradingCompany}-${serial}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Listing Price")}</span>
              <span>{priceThb ? `${Number(priceThb).toLocaleString()} THB` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Live Captures")}</span>
              <span>{Object.keys(captures).length} / {checklist.length}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)} disabled={submitting}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleConfirmAndSign} disabled={submitting || connecting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitting ? t("Creating…") : t("Confirm & Create Listing")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PsaLookupPanel({
  pending,
  result,
}: {
  pending: boolean;
  result: PsaCertLookupResult | null;
}) {
  const t = useT();
  if (pending) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        {t("Looking up this cert on PSA…")}
      </div>
    );
  }

  if (!result || result.status === "unavailable") {
    // Not an error worth alarming over — PSA isn't configured, hasn't
    // approved live access for this account yet, or the request failed.
    // The seller can still enter details manually; createListing's own
    // check never blocks on this state either.
    return null;
  }

  if (result.status === "not_found") {
    return (
      <div className="text-destructive flex items-center gap-2 text-xs">
        <SearchX className="size-3.5" />
        {t("No PSA cert found for this number. Double-check it against the slab label.")}
      </div>
    );
  }

  const cert = result.cert!;
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-success">
        <CheckCircle2 className="size-3.5" />
        {t("Verified live on PSA — details pre-filled below, edit freely")}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {cert.subject && (
          <div>
            <dt className="text-muted-foreground text-xs">{t("Subject")}</dt>
            <dd>{cert.subject}</dd>
          </div>
        )}
        {cert.year && (
          <div>
            <dt className="text-muted-foreground text-xs">{t("Year")}</dt>
            <dd>{cert.year}</dd>
          </div>
        )}
        {cert.brand && (
          <div>
            <dt className="text-muted-foreground text-xs">{t("Brand")}</dt>
            <dd>{cert.brand}</dd>
          </div>
        )}
        {cert.cardNumber && (
          <div>
            <dt className="text-muted-foreground text-xs">{t("Card #")}</dt>
            <dd className="font-mono">{cert.cardNumber}</dd>
          </div>
        )}
        {cert.cardGrade && (
          <div>
            <dt className="text-muted-foreground text-xs">{t("PSA Grade")}</dt>
            <dd>{cert.cardGrade}</dd>
          </div>
        )}
        {result.population?.total != null && (
          <div>
            <dt className="text-muted-foreground text-xs">{t("Total Population")}</dt>
            <dd>{result.population.total.toLocaleString()}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
