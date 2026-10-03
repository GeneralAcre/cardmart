"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { formatThb } from "@/lib/format";
import { displayImage } from "@/lib/card-image";
import type { AssetSummary } from "@/lib/types";
import { useT } from "@/components/landing/language-provider";

export interface TrendingListing {
  asset: AssetSummary;
  previousPriceThb: number;
  currentPriceThb: number;
  gainPct: number;
}

// Real "rising stars" — every entry here actually gained value between two
// real PriceSnapshot rows (see getTrendingListings in lib/queries.ts), never
// a fabricated trend. That's also why this only ever renders when there's
// at least one real gainer in either range: an empty or padded-out
// "Trending" row would be worse than no section at all.
export function TrendingStrip({ week, month }: { week: TrendingListing[]; month: TrendingListing[] }) {
  const [range, setRange] = useState<7 | 30>(week.length > 0 ? 7 : 30);
  const t = useT();
  if (week.length === 0 && month.length === 0) return null;
  const listings = range === 7 ? week : month;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-md">
          <TrendingUp className="size-3.5" />
        </div>
        <h2 className="eyebrow text-foreground text-sm">{t("Trending")}</h2>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {t("Biggest price gains in the last {days} days", { days: range })}
        </span>
        <div className="bg-card ml-auto flex rounded-lg border p-0.5 text-xs font-medium">
          {([7, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRange(days)}
              aria-pressed={range === days}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                range === days ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("{days} days", { days })}
            </button>
          ))}
        </div>
      </div>

      {listings.length === 0 && (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {t("No price gains in the last {days} days.", { days: range })}
        </p>
      )}

      {/* A compact, swipeable row so Trending previews the market without
          pushing the main listings grid below the fold. */}
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {listings.map(({ asset, previousPriceThb, currentPriceThb, gainPct }) => {
          const photo = displayImage(asset);
          const isGain = gainPct >= 0;
          return (
            <Link
              key={asset.id}
              href={`/item/${asset.id}`}
              className="group bg-card focus-visible:ring-ring flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 sm:w-44"
            >
              <div className="card-stage relative aspect-[4/5] overflow-hidden">
                {photo ? (
                  <Image
                    src={photo.url}
                    alt={asset.name}
                    fill
                    sizes="176px"
                    className="object-contain p-3 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    <CardArt
                      themeIndex={asset.themeIndex}
                      category={asset.category}
                      gradingCompany={asset.gradingCompany}
                      grade={asset.grade}
                      isBlackLabel={asset.isBlackLabel}
                      bordered={false}
                      className="h-full w-auto rounded-md"
                    />
                  </div>
                )}
                <span
                  className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1 text-[11px] font-semibold leading-none backdrop-blur-sm ${
                    isGain ? "text-success" : "text-destructive"
                  }`}
                >
                  {isGain ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {isGain ? "+" : ""}
                  {Math.round(gainPct)}%
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <h3 className="line-clamp-1 text-sm font-semibold">{asset.name}</h3>
                <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
                <span className={`mt-1 text-sm font-bold tabular-nums ${isGain ? "text-success" : "text-destructive"}`}>
                  {formatThb(currentPriceThb)}
                </span>
                <span className="text-muted-foreground text-[11px] tabular-nums line-through">{formatThb(previousPriceThb)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
