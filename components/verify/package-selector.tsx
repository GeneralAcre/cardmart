"use client";

import { CheckCircle2, Clock, PackageCheck, Sparkles } from "lucide-react";
import type { VerificationPackage } from "@prisma/client";

import { cn } from "@/lib/utils";
import { SELF_MINT_FEE_THB, FULL_SERVICE_PACKAGE_PRICE_THB, FULL_SERVICE_COST_BREAKDOWN } from "@/lib/pricing";

export function PackageSelector({
  value,
  onChange,
}: {
  value: VerificationPackage;
  onChange: (pkg: VerificationPackage) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-muted-foreground text-sm font-medium">Which one is you?</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("SELF_MINT")}
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors",
            value === "SELF_MINT" ? "border-primary ring-1 ring-primary" : "hover:bg-accent/40",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <PackageCheck className="size-4" />
              Instant Verify
            </div>
            {value === "SELF_MINT" && <CheckCircle2 className="text-primary size-5" />}
          </div>
          <p className="text-sm font-medium">
            &ldquo;I already have a PSA, BGS, or CGC slab in hand.&rdquo;
          </p>
          <p className="text-muted-foreground text-sm">
            Show it to your camera and get listed right away — no shipping,
            no waiting on anyone else.
          </p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-1">
            <div className="text-2xl font-semibold">฿{SELF_MINT_FEE_THB}</div>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3.5" /> Ready in minutes
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange("FULL_SERVICE")}
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors",
            value === "FULL_SERVICE" ? "border-primary ring-1 ring-primary" : "hover:bg-accent/40",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4" />
              Full-Service Grading
            </div>
            {value === "FULL_SERVICE" && <CheckCircle2 className="text-primary size-5" />}
          </div>
          <p className="text-sm font-medium">&ldquo;My item hasn&apos;t been graded yet.&rdquo;</p>
          <p className="text-muted-foreground text-sm">
            Send it to us — we cover the trip to the grading company and hand
            you back a finished listing.
          </p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-1">
            <div className="text-2xl font-semibold">฿{FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()}</div>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3.5" /> Takes a few weeks
            </span>
          </div>
          <ul className="text-muted-foreground flex flex-col gap-0.5 border-t pt-2 text-xs">
            <li>Shipping to grading company — ฿{FULL_SERVICE_COST_BREAKDOWN.shippingToGraderThb.toLocaleString()}</li>
            <li>Grading company fee — ฿{FULL_SERVICE_COST_BREAKDOWN.gradingFeeThb.toLocaleString()}</li>
            <li>Digital certificate creation — ฿{FULL_SERVICE_COST_BREAKDOWN.mintingFeeThb.toLocaleString()}</li>
          </ul>
        </button>
      </div>
    </div>
  );
}
