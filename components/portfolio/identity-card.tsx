"use client";

import { useActionState, useEffect, useState } from "react";
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
import { submitKyc, type KycState } from "@/lib/actions";
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
}: {
  status: KycStatus;
  rejectReason: string | null;
  rating: number | null;
  reviewCount: number;
  completedSales: number;
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
      {open && <KycDialog open={open} onOpenChange={setOpen} />}
    </div>
  );
}

const initialState: KycState = {};

function KycDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitKyc, initialState);
  const [idType, setIdType] = useState("NATIONAL_ID");

  useEffect(() => {
    if (state.ok) {
      toast.success("Submitted — we'll notify you once it's reviewed.");
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify your identity</DialogTitle>
          <DialogDescription>
            Our team checks these details by hand. We keep only the last 4 characters of your ID number and never
            ask for a photo of your ID.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kyc-name">Full legal name</Label>
            <Input id="kyc-name" name="legalName" autoComplete="name" required minLength={3} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="kyc-dob">Date of birth</Label>
              <Input id="kyc-dob" name="dateOfBirth" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>ID type</Label>
              <input type="hidden" name="idType" value={idType} />
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
            <Input id="kyc-id" name="idNumber" required autoComplete="off" inputMode="text" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox name="consent" value="on" className="mt-0.5" required />
            <span>These details are mine and accurate.</span>
          </label>
          {state.error && <p className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Submit for review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
