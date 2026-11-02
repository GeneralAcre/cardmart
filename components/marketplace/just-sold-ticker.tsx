"use client";

import Image from "next/image";
import Link from "next/link";

import type { RecentSale } from "@/lib/recent-sales";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/currency-provider";
import { useT } from "@/components/landing/language-provider";
import type { Translate } from "@/lib/i18n/translate";

function ago(iso: string, t: Translate) {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return t("Just now");
  if (minutes < 24 * 60)
    return t("{hours}h ago", { hours: Math.floor(minutes / 60) });
  const days = Math.floor(minutes / (24 * 60));
  return days === 1 ? t("Yesterday") : t("{days} days ago", { days });
}

function VsMarket({ pct, t }: { pct: number | null; t: Translate }) {
  if (pct == null) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        pct < 0
          ? "bg-success/15 text-success"
          : pct > 0
            ? "bg-destructive/15 text-destructive"
            : "bg-secondary text-muted-foreground",
      )}
    >
      {pct === 0
        ? t("At market price")
        : pct < 0
          ? t("{pct}% under market", { pct: -pct })
          : t("{pct}% over market", { pct })}
    </span>
  );
}

/**
 * A strip of the latest real sales that scrolls sideways on its own, under
 * the Market banner. The list is rendered twice so moving it by -50% lands
 * exactly back on the start; hovering pauses it so a sale can be clicked.
 */
export function JustSoldTicker({ sales }: { sales: RecentSale[] }) {
  const t = useT();
  const money = useMoney();
  if (sales.length === 0) return null;

  // Each group ends with the same padding as the gap between items, so both
  // copies are exactly one loop wide.
  const group = (copy: boolean) => (
    <div className="flex shrink-0 gap-2 pr-2" aria-hidden={copy || undefined}>
      {sales.map((s) => (
        <Link
          key={s.id}
          href={`/item/${s.assetId}`}
          tabIndex={copy ? -1 : undefined}
          className="hover:bg-accent flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors"
        >
          {s.imageUrl && (
            <span className="bg-muted relative h-7 w-5 shrink-0 overflow-hidden rounded-sm">
              <Image
                src={s.imageUrl}
                alt=""
                fill
                sizes="20px"
                className="object-cover"
              />
            </span>
          )}
          <span className="max-w-48 truncate font-medium">
            {s.cardNumber && (
              <span className="text-muted-foreground">#{s.cardNumber} </span>
            )}
            {s.name}
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {money(s.priceThb)}
          </span>
          <VsMarket pct={s.vsMarketPct} t={t} />
          <span className="text-muted-foreground text-xs">
            {ago(s.soldAt, t)}
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="bg-card flex items-center overflow-hidden rounded-full border">
      <span className="flex shrink-0 items-center gap-2 border-r px-4 py-2 text-sm font-semibold">
        <span className="relative flex size-2">
          <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-success relative inline-flex size-2 rounded-full" />
        </span>
        {t("Just sold")}
      </span>
      <div className="ticker-mask group relative min-w-0 flex-1 overflow-hidden">
        <div
          className="animate-ticker flex w-max py-1.5 group-hover:[animation-play-state:paused]"
          // About 6 seconds per sale, so the speed stays the same however many there are.
          style={{ animationDuration: `${sales.length * 6}s` }}
        >
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}
