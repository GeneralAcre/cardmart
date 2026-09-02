"use client";

import { CheckCircle2, PackageCheck, Sparkles } from "lucide-react";
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
            Self-Mint
          </div>
          {value === "SELF_MINT" && <CheckCircle2 className="text-primary size-5" />}
        </div>
        <p className="text-muted-foreground text-sm">
          You already hold an official PSA / BGS / CGC slab. Verify the
          certificate yourself and mint the digital twin instantly.
        </p>
        <div className="text-2xl font-semibold">฿{SELF_MINT_FEE_THB}</div>
        <p className="text-muted-foreground text-xs">
          Flat minting fee. You cover shipping to our warehouse if and when it sells.
        </p>
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
        <p className="text-muted-foreground text-sm">
          Your item isn&apos;t graded yet. We ship it to the grading company,
          cover the grading fee, and mint the digital twin for you.
        </p>
        <div className="text-2xl font-semibold">฿{FULL_SERVICE_PACKAGE_PRICE_THB.toLocaleString()}</div>
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <li>Shipping to grading company — ฿{FULL_SERVICE_COST_BREAKDOWN.shippingToGraderThb.toLocaleString()}</li>
          <li>Grading company fee — ฿{FULL_SERVICE_COST_BREAKDOWN.gradingFeeThb.toLocaleString()}</li>
          <li>Digital twin minting — ฿{FULL_SERVICE_COST_BREAKDOWN.mintingFeeThb.toLocaleString()}</li>
        </ul>
      </button>
    </div>
  );
}
