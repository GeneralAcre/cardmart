import Image from "next/image";
import Link from "next/link";
import { Images } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { Badge } from "@/components/ui/badge";
import { formatGrade, formatThb } from "@/lib/format";
import { CARD_GAME_LABELS, MARKET_STATUS_BADGE_CLASS, MARKET_STATUS_LABELS } from "@/lib/labels";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayImage, realPhotos } from "@/lib/card-image";

export function ListingCard({ asset }: { asset: AssetSummary }) {
  const photos = realPhotos(asset.verificationPhotos);
  const image = displayImage(asset);

  return (
    <Link
      href={`/item/${asset.id}`}
      className="group focus-visible:ring-ring relative rounded-xl outline-none focus-visible:ring-2"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 rounded-xl bg-[conic-gradient(from_180deg,#8b5cf6,#3b82f6,#22d3ee,#ec4899,#8b5cf6)] opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70"
      />
      <div className="bg-card relative flex flex-col gap-3 overflow-hidden rounded-xl border shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[3/4]">
          {image ? (
            // Real live-camera capture instead of the generated digital-twin
            // art whenever one exists — this is what the item actually
            // looks like, not a placeholder. next/image handles resizing,
            // format conversion, and lazy-loading automatically — no manual
            // step needed per upload, it optimizes on request from the
            // original Blob URL every time this card renders.
            <Image
              src={image.url}
              alt={asset.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
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
          <Badge
            className={cn(
              "absolute right-2 top-2 border-0",
              MARKET_STATUS_BADGE_CLASS[asset.marketStatus],
            )}
          >
            {MARKET_STATUS_LABELS[asset.marketStatus]}
          </Badge>
          {/* Grade is the single most decision-relevant fact for a graded
              collectible — it needs to survive in the grid view even when a
              real verification photo, not the grade-labeled generated art,
              is what's shown (the generated art already renders it inline). */}
          {photos.length > 0 && (
            <span
              className={cn(
                "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm",
                asset.isBlackLabel ? "bg-neutral-900/90 text-amber-400" : "bg-foreground/90 text-background",
              )}
            >
              {asset.gradingCompany === "RAW" ? "RAW" : `${asset.gradingCompany} ${formatGrade(asset.grade)}`}
              {asset.isBlackLabel && " · Black Label"}
            </span>
          )}
          {photos.length > 1 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <Images className="size-3" />
              {photos.length} views
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{CARD_GAME_LABELS[asset.game]}</span>
            <h3 className="line-clamp-1 text-sm font-semibold">{asset.name}</h3>
            <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
          </div>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
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
}
