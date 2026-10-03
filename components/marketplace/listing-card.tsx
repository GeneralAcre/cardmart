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

const CHIP = "rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold leading-none text-white backdrop-blur-sm";

export function ListingCard({ asset, compact = false }: { asset: AssetSummary; compact?: boolean }) {
  const photos = realPhotos(asset.verificationPhotos);
  const image = displayImage(asset);
  const t = useT();
  const sellerName = asset.seller.name ?? t("Collector");

  return (
    <Link
      href={`/item/${asset.id}`}
      className="group bg-card focus-visible:ring-ring relative flex flex-col overflow-hidden rounded-2xl border outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2"
    >
      {/* The card sits on a dark spotlight "stage", shown whole (contain)
          rather than cropped, the way a slab photo would be. */}
      <div className="card-stage relative aspect-[4/5] overflow-hidden">
        {image ? (
          // Real live-camera capture instead of the generated digital-twin
          // art whenever one exists — this is what the item actually
          // looks like, not a placeholder. next/image handles resizing,
          // format conversion, and lazy-loading automatically.
          <Image
            src={image.url}
            alt={asset.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
            className="object-contain p-4 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.04] sm:p-5"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-5 transition-transform duration-300 group-hover:scale-[1.04]">
            <CardArt
              themeIndex={asset.themeIndex}
              category={asset.category}
              gradingCompany={asset.gradingCompany}
              grade={asset.grade}
              isBlackLabel={asset.isBlackLabel}
              bordered={false}
              showGrade={false}
              className="h-full w-auto rounded-lg"
            />
          </div>
        )}

        {/* Top corners: what game this is, and which way its price last moved. */}
        <span className={cn(CHIP, "absolute left-2.5 top-2.5")}>{t(CARD_GAME_LABELS[asset.game])}</span>
        {asset.priceDirection && (
          <span
            className={cn(
              CHIP,
              "absolute right-2.5 top-2.5",
              asset.priceDirection === "up" ? "text-success" : "text-destructive",
            )}
            aria-label={asset.priceDirection === "up" ? t("Price went up") : t("Price went down")}
          >
            {asset.priceDirection === "up" ? "▲" : "▼"}
          </span>
        )}

        {/* An official catalogue image is the card, not this copy — say so. */}
        {image?.kind === "reference" && (
          <span className={cn(CHIP, "absolute bottom-2.5 left-2.5 font-medium")}>{t("Reference image")}</span>
        )}
        {photos.length > 1 && (
          <span className={cn(CHIP, "absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 font-medium")}>
            <Images className="size-3" />
            {t("{count} views", { count: photos.length })}
          </span>
        )}
        {asset.vaulted && (
          <span className={cn(CHIP, "absolute bottom-2.5 right-2.5")}>{t("In Vault")}</span>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-1", compact ? "p-3" : "p-3.5 sm:p-4")}>
        <h3 className={cn("line-clamp-1 font-semibold", compact ? "text-sm" : "text-base")}>{asset.name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {asset.subtitle}
          {asset.cardNumber && <span className="font-mono"> · #{asset.cardNumber}</span>}
        </p>
        <span
          className={cn(
            "mt-1.5 font-bold tabular-nums",
            compact ? "text-base" : "text-lg",
            asset.priceDirection === "up" && "text-success",
            asset.priceDirection === "down" && "text-destructive",
          )}
        >
          {asset.priceThb != null ? formatThb(asset.priceThb) : t("Price unavailable")}
        </span>

        {/* Footer: who's selling it, and the grade chip. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span className="bg-secondary text-foreground flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase">
              {sellerName[0]}
            </span>
            <span className="truncate">{sellerName}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] leading-none">
            {asset.language === "JAPANESE" && (
              <span className="text-muted-foreground font-semibold" title={t("Japanese")}>
                JP ·
              </span>
            )}
            {asset.gradingCompany === "RAW" ? (
              <span className="font-semibold">{t("Raw / Ungraded")}</span>
            ) : (
              <>
                <span className="sr-only">{t("Grade:")} </span>
                <span className="text-muted-foreground">{asset.gradingCompany}</span>
                <span className="font-bold">{formatGrade(asset.grade)}</span>
              </>
            )}
            {asset.isBlackLabel && <span className="font-semibold text-amber-500">· BL</span>}
          </span>
        </div>
      </div>
    </Link>
  );
}
