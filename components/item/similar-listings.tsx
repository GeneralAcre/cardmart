import Image from "next/image";
import Link from "next/link";
import { Scale } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { displayImage } from "@/lib/card-image";
import { formatThb } from "@/lib/format";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// Same card (same name, grading company and grade), listed by other
// sellers — from getSimilarAssets, sorted cheapest-first. The delta badge is
// the point: it says who's pricing this exact card higher or lower than the
// listing you're currently looking at, not "here are some related items".
export async function SimilarListings({
  currentPriceThb,
  listings,
}: {
  currentPriceThb: number | null;
  listings: AssetSummary[];
}) {
  if (listings.length === 0) return null;
  const t = await getT();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-md">
          <Scale className="size-3.5" />
        </div>
        <h2 className="eyebrow text-foreground text-sm">{t("Compare Prices")}</h2>
        <span className="text-muted-foreground text-xs">{t("Same card, other sellers — cheapest first")}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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
              className="group focus-visible:ring-ring rounded-2xl outline-none focus-visible:ring-2"
            >
              <div className="bg-card flex flex-col overflow-hidden rounded-2xl border transition-colors group-hover:border-foreground/30">
                <div className="card-stage relative aspect-[4/5] overflow-hidden">
                  {photo ? (
                    <Image
                      src={photo.url}
                      alt={asset.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-contain p-4 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <CardArt
                        themeIndex={asset.themeIndex}
                        category={asset.category}
                        gradingCompany={asset.gradingCompany}
                        grade={asset.grade}
                        isBlackLabel={asset.isBlackLabel}
                        bordered={false}
                        className="h-full w-auto rounded-lg"
                      />
                    </div>
                  )}
                  {deltaPct != null && Math.abs(deltaPct) >= 1 && (
                    <span
                      className={cn(
                        "absolute right-2.5 top-2.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold leading-none backdrop-blur-sm",
                        deltaPct >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {deltaPct < 0 ? "▼" : "▲"} {Math.abs(Math.round(deltaPct))}%
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-3.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-muted-foreground text-[11px]">{t("Seller")}</span>
                    <span className="truncate text-xs font-medium">{asset.seller.name}</span>
                  </div>
                  <span
                    className={cn(
                      "text-base font-bold tabular-nums",
                      asset.priceDirection === "up" && "text-success",
                      asset.priceDirection === "down" && "text-destructive",
                    )}
                  >
                    {asset.priceThb != null ? formatThb(asset.priceThb) : t("Not for sale")}
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
