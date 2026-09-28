"use client";

import Image from "next/image";
import Link from "next/link";
import { Images } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { formatGrade, formatThb } from "@/lib/format";
import { CARD_GAME_LABELS } from "@/lib/labels";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayImage, realPhotos } from "@/lib/card-image";
import { useT } from "@/components/landing/language-provider";

export function ListingCard({ asset }: { asset: AssetSummary }) {
  const photos = realPhotos(asset.verificationPhotos);
  const image = displayImage(asset);
  const t = useT();

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
              showGrade={false}
            />
          )}
          {/* An official catalogue image is the card, not this copy — say so. */}
          {image?.kind === "reference" && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {t("Reference image")}
            </span>
          )}
          {photos.length > 1 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <Images className="size-3" />
              {t("{count} views", { count: photos.length })}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{t(CARD_GAME_LABELS[asset.game])}</span>
            <h3 className="line-clamp-1 text-sm font-semibold">{asset.name}</h3>
            <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
            <p className="text-foreground line-clamp-1 text-xs font-medium">
              <span className="text-muted-foreground">{t("Grade:")} </span>
              {asset.gradingCompany === "RAW" ? t("Raw / Ungraded") : `${asset.gradingCompany} ${formatGrade(asset.grade)}`}
              {asset.isBlackLabel && <span className="text-amber-500"> · Black Label</span>}
            </p>
          </div>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              asset.priceDirection === "up" && "text-success",
              asset.priceDirection === "down" && "text-destructive",
            )}
          >
            {asset.priceThb != null ? formatThb(asset.priceThb) : t("Price unavailable")}
          </span>
        </div>
      </div>
    </Link>
  );
}
