"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Clock, Loader2, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import type { KycStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KycCamera, type KycShot } from "@/components/portfolio/kyc-camera";
import { submitKyc } from "@/lib/actions";
import { KYC_ID_TYPE_LABELS, KYC_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STATUS_ICON = { NONE: ShieldAlert, PENDING: Clock, VERIFIED: BadgeCheck, REJECTED: ShieldAlert } as const;

/**
 * Trust & Safety summary for the signed-in user: their identity (KYC) status,
 * plus the reputation buyers already see: star rating and completed sales,
 * all backed by escrow.
 */
export function IdentityCard({
  status,
  rejectReason,
  rating,
  reviewCount,
  completedSales,
  photoStorageReady,
}: {
  status: KycStatus;
  rejectReason: string | null;
  rating: number | null;
  reviewCount: number;
  completedSales: number;
  /** Whether the private Blob store for ID photos is configured (KYC_BLOB_READ_WRITE_TOKEN). */
  photoStorageReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = STATUS_ICON[status];
  const canSubmit = status === "NONE" || status === "REJECTED";

  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            status === "VERIFIED" ? "bg-success text-success-foreground" : "bg-muted text-foreground",
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">Trust &amp; Safety · {KYC_STATUS_LABELS[status]}</span>
          <span className="text-muted-foreground text-xs">
            {status === "VERIFIED"
              ? "Buyers see an ID-verified badge on your store and listings."
              : status === "PENDING"
                ? "Our team is reviewing your details. You'll get a notification once it's done."
                : status === "REJECTED"
                  ? `${rejectReason ?? "We couldn't confirm your details."} You can submit again.`
                  : "Verify your identity to earn an ID-verified badge buyers can trust."}
          </span>
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" />
              {rating != null && reviewCount > 0 ? `${rating.toFixed(1)} from ${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No ratings yet"}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3" />
              {completedSales} completed sale{completedSales === 1 ? "" : "s"} through escrow
            </span>
          </span>
        </div>
      </div>
      {canSubmit && (
        <Button size="sm" onClick={() => setOpen(true)}>
          <BadgeCheck /> Verify identity
        </Button>
      )}
      {open && <KycDialog open={open} onOpenChange={setOpen} photoStorageReady={photoStorageReady} />}
    </div>
  );
}

const STEPS = ["Details", "ID photo", "Selfie", "Review"] as const;

function KycDialog({
  open,
  onOpenChange,
  photoStorageReady,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoStorageReady: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [idType, setIdType] = useState("NATIONAL_ID");
  const [details, setDetails] = useState({ legalName: "", dateOfBirth: "", idNumber: "" });
  const [idShot, setIdShot] = useState<KycShot | null>(null);
  const [selfieShot, setSelfieShot] = useState<KycShot | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Release preview object URLs when a photo is replaced or the dialog closes.
  useEffect(() => () => { if (idShot) URL.revokeObjectURL(idShot.previewUrl); }, [idShot]);
  useEffect(() => () => { if (selfieShot) URL.revokeObjectURL(selfieShot.previewUrl); }, [selfieShot]);

  const detailsComplete =
    details.legalName.trim().length >= 3 && Boolean(details.dateOfBirth) && details.idNumber.trim().length >= 5;
  const canContinue = [detailsComplete, Boolean(idShot), Boolean(selfieShot), consent][step];

  function submit() {
    if (!idShot || !selfieShot) return;
    setError(null);
    const fd = new FormData();
    fd.set("legalName", details.legalName);
    fd.set("dateOfBirth", details.dateOfBirth);
    fd.set("idType", idType);
    fd.set("idNumber", details.idNumber);
    fd.set("consent", consent ? "on" : "");
    fd.set("idPhoto", new File([idShot.blob], "id.jpg", { type: "image/jpeg" }));
    fd.set("selfie", new File([selfieShot.blob], "selfie.jpg", { type: "image/jpeg" }));
    startTransition(async () => {
      try {
        const result = await submitKyc({}, fd);
        if (result.error) {
          setError(result.error);
          // Detail problems (bad ID number, under 18…) are fixed on step 1.
          if (!/photo/i.test(result.error)) setStep(0);
          return;
        }
        toast.success("Submitted — we'll notify you once it's reviewed.");
        onOpenChange(false);
        router.refresh();
      } catch {
        setError("Couldn't submit right now. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verify your identity</DialogTitle>
          <DialogDescription>
            Takes about a minute. Staff check your details and photos by hand, usually within a day.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-col gap-1">
              <span className={cn("h-1 rounded-full", i <= step ? "bg-success" : "bg-muted")} />
              <span className={cn("text-[11px]", i === step ? "text-foreground font-medium" : "text-muted-foreground")}>
                {label}
              </span>
            </li>
          ))}
        </ol>

        {!photoStorageReady && (
          <p className="text-destructive rounded-lg border border-dashed p-3 text-sm">
            ID photo storage isn&apos;t set up on this site yet, so verification can&apos;t be submitted right now.
          </p>
        )}

        <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
          {step === 0 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kyc-name">Full legal name (as on your ID)</Label>
                <Input
                  id="kyc-name"
                  autoComplete="name"
                  value={details.legalName}
                  onChange={(e) => setDetails({ ...details, legalName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kyc-dob">Date of birth</Label>
                  <Input
                    id="kyc-dob"
                    type="date"
                    value={details.dateOfBirth}
                    onChange={(e) => setDetails({ ...details, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>ID type</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(KYC_ID_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kyc-id">ID number</Label>
                <Input
                  id="kyc-id"
                  autoComplete="off"
                  inputMode={idType === "NATIONAL_ID" ? "numeric" : "text"}
                  placeholder={idType === "NATIONAL_ID" ? "13 digits, e.g. 1-2345-67890-12-3" : undefined}
                  value={details.idNumber}
                  onChange={(e) => setDetails({ ...details, idNumber: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">
                  Thai ID numbers are checked automatically. Only the last 4 characters are stored.
                </p>
              </div>
            </>
          )}

          {/* Separate keys: each step gets its own camera instance and state. */}
          {step === 1 && <KycCamera key="id" kind="id" shot={idShot} onShot={setIdShot} />}
          {step === 2 && <KycCamera key="selfie" kind="selfie" shot={selfieShot} onShot={setSelfieShot} />}

          {step === 3 && idShot && selfieShot && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { shot: idShot, label: "ID card" },
                  { shot: selfieShot, label: "Selfie with ID" },
                ].map(({ shot, label }) => (
                  <figure key={label} className="flex flex-col gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.previewUrl} alt={label} className="bg-muted aspect-[4/3] w-full rounded-lg border object-cover" />
                    <figcaption className="text-muted-foreground text-xs">{label}</figcaption>
                  </figure>
                ))}
              </div>
              <dl className="bg-muted/40 grid grid-cols-1 gap-2 rounded-lg p-3 text-sm sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Legal name</dt>
                  <dd className="truncate font-medium">{details.legalName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Date of birth</dt>
                  <dd className="font-medium">{details.dateOfBirth}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{KYC_ID_TYPE_LABELS[idType as keyof typeof KYC_ID_TYPE_LABELS]}</dt>
                  <dd className="font-medium">•••• {details.idNumber.replace(/[\s-]/g, "").slice(-4)}</dd>
                </div>
              </dl>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                <span>
                  These details and photos are mine and accurate. I agree to CardMart staff reviewing them to verify my
                  identity. The photos are stored privately and only staff can see them.
                </span>
              </label>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
              disabled={pending}
            >
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => { setError(null); setStep(step + 1); }} disabled={!canContinue}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={!canContinue || pending || !photoStorageReady}>
                {pending && <Loader2 className="animate-spin" />}
                Submit for review
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
