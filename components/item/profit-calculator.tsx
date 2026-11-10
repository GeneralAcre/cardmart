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
    // Open, it fills its column, so its bottom lines up with the panel beside it.
    <details className="detail-panel group rounded-2xl border open:flex-1">
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

        {/* Price and fee fold into one "You pay" line; break-even only shows when
            shipping makes it differ from what you paid. */}
        <dl className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="flex flex-col">
              <span className="font-semibold">{t("You pay")}</span>
              <span className="text-muted-foreground text-xs">
                {formatThb(priceThb)} + {t("Buyer protection ({pct}%)", { pct: BUYER_FEE_PERCENT })} {formatThb(fee)}
              </span>
            </dt>
            <dd className="font-semibold tabular-nums">{formatThb(paid)}</dd>
          </div>
          {breakEven !== paid && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {t("Break even (resale incl. {shipping} shipping)", { shipping: formatThb(SELLER_SHIPPING_COST_THB) })}
              </dt>
              <dd className="font-semibold tabular-nums">{formatThb(breakEven)}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3">
          <label htmlFor="resale-price" className="text-muted-foreground text-xs">
            {t("If you resell at (THB)")}
          </label>
          <Input
            id="resale-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={resale}
            onChange={(e) => setResale(e.target.value)}
            placeholder={t("Resale price")}
            className="h-8 w-32"
          />
          {profit != null && (
            <span className={cn("font-semibold tabular-nums", tone(profit))}>
              {signed(profit)} <span className="text-xs font-medium">({((profit / paid) * 100).toFixed(1)}%)</span>
            </span>
          )}
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
      </div>
    </details>
  );
}
