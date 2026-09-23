import Image from "next/image";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { formatThb } from "@/lib/format";
import type { AssetSummary } from "@/lib/types";

export interface TrendingListing {
  asset: AssetSummary;
  previousPriceThb: number;
  currentPriceThb: number;
  gainPct: number;
}

// Real "rising stars" — every entry here actually gained value between two
// real PriceSnapshot rows (see getTrendingListings in lib/queries.ts), never
// a fabricated trend. That's also why this only ever renders when there's
// at least one real gainer: an empty or padded-out "Trending" row would be
// worse than no section at all.
export function TrendingStrip({ listings }: { listings: TrendingListing[] }) {
  if (listings.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
          <TrendingUp className="size-3.5" />
        </div>
        <h2 className="text-lg font-semibold">Trending</h2>
        <span className="text-muted-foreground text-xs">Biggest price gains this week</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {listings.map(({ asset, previousPriceThb, currentPriceThb, gainPct }) => {
          const photo = asset.verificationPhotos[0];
          const isGain = gainPct >= 0;
          return (
            <Link
              key={asset.id}
              href={`/item/${asset.id}`}
              className="group focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
            >
              <div className="bg-card flex flex-col gap-3 overflow-hidden rounded-xl border shadow-sm transition-shadow group-hover:shadow-md">
                <div className="relative aspect-[3/4]">
                  {photo ? (
                    <Image
                      src={photo.url}
                      alt={asset.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <CardArt
                      themeIndex={asset.themeIndex}
                      category={asset.category}
                      gradingCompany={asset.gradingCompany}
                      grade={asset.grade}
                      isBlackLabel={asset.isBlackLabel}
                      bordered={false}
                    />
                  )}
                  <span
                    className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${
                      isGain ? "bg-emerald-400 text-emerald-950" : "bg-red-500 text-white"
                    }`}
                  >
                    {isGain ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {isGain ? "+" : ""}
                    {Math.round(gainPct)}%
                  </span>
                </div>
                <div className="flex flex-col gap-3 px-3 pb-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="line-clamp-1 text-sm font-semibold">{asset.name}</h3>
                    <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs line-through">{formatThb(previousPriceThb)}</span>
                    <span className="text-sm font-semibold">{formatThb(currentPriceThb)}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
