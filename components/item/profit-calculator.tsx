"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatThb } from "@/lib/format";
import { BUYER_FEE_PERCENT, buyerFeeThb, SELLER_SHIPPING_COST_THB } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

const tone = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground");
const signed = (v: number) => (v === 0 ? formatThb(0) : `${v > 0 ? "+" : "−"}${formatThb(Math.abs(v))}`);

/**
 * What buying this listing costs and what reselling it would make, after
 * CardMart's fees: the buyer-protection fee now, and — if the card is shipped
 * home rather than kept in the vault — the seller's shipping to the warehouse
 * when it's resold. Vaulted cards resell with no shipping.
 */
export function ProfitCalculator({ priceThb, marketThb }: { priceThb: number; marketThb: number | null }) {
  const { tr: t } = useLanguage();
  const [keep, setKeep] = useState<"vault" | "home">("vault");
  const [resale, setResale] = useState(marketThb != null ? String(marketThb) : "");

  const fee = buyerFeeThb(priceThb);
  const paid = priceThb + fee;
  const resaleCost = keep === "home" ? SELLER_SHIPPING_COST_THB : 0;
  const breakEven = paid + resaleCost;
  const resaleThb = Number(resale);
  const profit = resale && resaleThb > 0 ? resaleThb - resaleCost - paid : null;
  const marketProfit = marketThb != null ? marketThb - resaleCost - paid : null;

  return (
    <details className="detail-panel group rounded-2xl border" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="text-muted-foreground size-4" /> {t("Profit calculator")}
        </span>
        {marketProfit != null && (
          <span className={cn("text-sm font-semibold tabular-nums", tone(marketProfit))}>
            {t("{amount} at market", { amount: signed(marketProfit) })}
          </span>
        )}
      </summary>

      <div className="flex flex-col gap-3 border-t p-4 text-sm">
        <div className="bg-muted flex w-fit rounded-lg p-0.5 text-xs font-medium" role="group" aria-label={t("After buying")}>
          {(
            [
              { key: "vault", label: t("Keep in vault") },
              { key: "home", label: t("Ship to me") },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setKeep(o.key)}
              aria-pressed={keep === o.key}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                keep === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <dl className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("Price")}</dt>
            <dd className="tabular-nums">{formatThb(priceThb)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("Buyer protection ({pct}%)", { pct: BUYER_FEE_PERCENT })}</dt>
            <dd className="tabular-nums">{formatThb(fee)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-1.5 font-semibold">
            <dt>{t("You pay")}</dt>
            <dd className="tabular-nums">{formatThb(paid)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              {keep === "home" ? t("Break even (resale incl. {shipping} shipping)", { shipping: formatThb(SELLER_SHIPPING_COST_THB) }) : t("Break even")}
            </dt>
            <dd className="font-semibold tabular-nums">{formatThb(breakEven)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <label htmlFor="resale-price" className="text-muted-foreground text-xs">
            {t("If you resell at (THB)")}
          </label>
          <div className="flex items-center gap-3">
            <Input
              id="resale-price"
              type="number"
              inputMode="numeric"
              min={0}
              value={resale}
              onChange={(e) => setResale(e.target.value)}
              placeholder={t("Resale price")}
              className="h-9 max-w-40"
            />
            {profit != null && (
              <span className={cn("font-semibold tabular-nums", tone(profit))}>
                {signed(profit)} <span className="text-xs font-medium">({((profit / paid) * 100).toFixed(1)}%)</span>
              </span>
            )}
          </div>
          {marketThb != null && resaleThb !== marketThb && (
            <button
              type="button"
              onClick={() => setResale(String(marketThb))}
              className="text-muted-foreground hover:text-foreground w-fit text-xs underline underline-offset-2"
            >
              {t("Use market price ({price})", { price: formatThb(marketThb) })}
            </button>
          )}
        </div>
        <p className="text-muted-foreground text-[11px]">
          {t("The next buyer pays their own protection fee, so reselling a vaulted card costs you nothing extra on CardMart.")}
        </p>
      </div>
    </details>
  );
}
