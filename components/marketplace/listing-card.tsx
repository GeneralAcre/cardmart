import Link from "next/link";
import { Images } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { Badge } from "@/components/ui/badge";
import { formatThb } from "@/lib/format";
import { CATEGORY_LABELS, MARKET_STATUS_BADGE_CLASS, MARKET_STATUS_LABELS } from "@/lib/labels";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingCard({ asset }: { asset: AssetSummary }) {
  const photos = asset.verificationPhotos;

  return (
    <Link
      href={`/item/${asset.id}`}
      className="group focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
    >
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative">
          {photos.length > 0 ? (
            // Real live-camera capture instead of the generated digital-twin
            // art whenever one exists — this is what the item actually
            // looks like, not a placeholder.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[0].url}
              alt={asset.name}
              className="aspect-[3/4] w-full rounded-lg border object-cover"
            />
          ) : (
            <CardArt
              themeIndex={asset.themeIndex}
              category={asset.category}
              gradingCompany={asset.gradingCompany}
              grade={asset.grade}
            />
          )}
          <Badge
            className={cn(
              "absolute right-2 top-2 border-0",
              MARKET_STATUS_BADGE_CLASS[asset.marketStatus],
            )}
          >
            {MARKET_STATUS_LABELS[asset.marketStatus]}
          </Badge>
          {photos.length > 1 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <Images className="size-3" />
              {photos.length} views
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{CATEGORY_LABELS[asset.category]}</span>
          <h3 className="line-clamp-1 text-sm font-semibold">{asset.name}</h3>
          <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-muted-foreground font-mono text-[11px]">{asset.serial}</span>
          <span className="text-sm font-semibold">
            {asset.priceThb != null ? formatThb(asset.priceThb) : "Not for sale"}
          </span>
        </div>
      </div>
    </Link>
  );
}
