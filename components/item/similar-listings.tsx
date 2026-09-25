import Image from "next/image";
import Link from "next/link";
import { Scale } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { displayImage } from "@/lib/card-image";
import { formatThb } from "@/lib/format";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

// Same card (same name, grading company and grade), listed by other
// sellers — from getSimilarAssets, sorted cheapest-first. The delta badge is
// the point: it says who's pricing this exact card higher or lower than the
// listing you're currently looking at, not "here are some related items".
export function SimilarListings({
  currentPriceThb,
  listings,
}: {
  currentPriceThb: number | null;
  listings: AssetSummary[];
}) {
  if (listings.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
          <Scale className="size-3.5" />
        </div>
        <h2 className="text-lg font-semibold">Compare Prices</h2>
        <span className="text-muted-foreground text-xs">Same card, other sellers — cheapest first</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {listings.map((asset) => {
          const photo = displayImage(asset);
          const deltaPct =
            currentPriceThb != null && currentPriceThb > 0 && asset.priceThb != null
              ? ((asset.priceThb - currentPriceThb) / currentPriceThb) * 100
              : null;

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
                  {deltaPct != null && Math.abs(deltaPct) >= 1 && (
                    <span
                      className={cn(
                        "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                        deltaPct >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-white",
                      )}
                    >
                      {deltaPct < 0 ? "" : "+"}
                      {Math.round(deltaPct)}%
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-muted-foreground text-[11px]">Seller</span>
                    <span className="truncate text-xs font-medium">{asset.seller.name}</span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      asset.priceDirection === "up" && "text-success",
                      asset.priceDirection === "down" && "text-destructive",
                    )}
                  >
                    {asset.priceThb != null ? formatThb(asset.priceThb) : "Not for sale"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
