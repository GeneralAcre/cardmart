"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bidIncrement } from "@/lib/auction-rules";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

/** The step a seller left blank falls back to the automatic one for their starting price. */
export function resolveBidStep(value: string, startPrice: string): number {
  return value ? Number(value) : bidIncrement(Number(startPrice) || 0);
}

/** "Bid step (THB)" for the Start Auction forms: how much each new bid must beat the last by. */
export function BidStepField({
  id,
  value,
  onChange,
  startPrice,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  startPrice: string;
}) {
  const t = useT();
  const step = resolveBidStep(value, startPrice);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("Bid step (THB)")}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={10}
        placeholder={String(bidIncrement(Number(startPrice) || 0))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        {t("Each new bid must be at least {step} higher than the last.", { step: formatThb(step) })}
      </p>
    </div>
  );
}
