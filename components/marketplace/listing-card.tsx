"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Images, Scale } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { formatGrade, formatThb } from "@/lib/format";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayImage, realPhotos } from "@/lib/card-image";
import { useT } from "@/components/landing/language-provider";
import { RarityTag } from "@/components/item/rarity-badge";
import { UserAvatar } from "@/components/messages/user-avatar";
import { ChangeTag } from "@/components/ui/change-tag";

const CHIP = "rounded-md px-2 py-1 text-[11px] font-semibold leading-none text-white backdrop-blur-sm";

/** The marketplace grid's "add to comparison" toggle; left out everywhere else. */
export interface CompareToggle {
  selected: boolean;
  // The comparison is full and this card isn't in it.
  disabled: boolean;
  onToggle: () => void;
}

export function ListingCard({
  asset,
  compact = false,
  compare,
}: {
  asset: AssetSummary;
  compact?: boolean;
  compare?: CompareToggle;
}) {
  const photos = realPhotos(asset.verificationPhotos);
  const image = displayImage(asset);
  const t = useT();
  const sellerName = asset.seller.name ?? t("Collector");

  const card = (
    <Link
      href={`/item/${asset.id}`}
      className="group bg-card focus-visible:ring-ring relative flex w-full flex-col overflow-hidden rounded-2xl border outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2"
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
            className="object-contain p-4 photo-shadow transition-transform duration-300 group-hover:scale-[1.04] sm:p-5"
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

        {/* Top corners, like a slab label: the grade on a dark chip (reads over
            any artwork) on the left, the rarity tag on the right. Keeping the
            rarity off the name row lets the full name show. */}
        <GradeChip asset={asset} className={cn(CHIP, "absolute left-2.5 top-2.5 bg-black/70 py-1.5 font-normal")} />
        {asset.rarity && (
          <span className="absolute right-2.5 top-2.5 flex">
            <RarityTag rarity={asset.rarity} />
          </span>
        )}

        {photos.length > 1 && (
          <span className={cn(CHIP, "absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-black/70 font-medium")}>
            <Images className="size-3" />
            {t("{count} views", { count: photos.length })}
          </span>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-1", compact ? "p-3" : "p-3.5 sm:p-4")}>
        {/* Up to two lines: edition and variant words ("1st Edition", "Alt Art") decide what a card is worth. */}
        <h3 className={cn("line-clamp-2 leading-snug font-semibold", compact ? "text-[13px]" : "text-sm sm:text-[15px]")}>{asset.name}</h3>
        {/* The set only; the card number and seller are on the item page. */}
        <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>

        {/* Bottom row: the seller's picture on the left (name on hover), the price on the right. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span title={sellerName} aria-label={t("Seller: {name}", { name: sellerName })}>
            <UserAvatar user={{ name: sellerName, handle: null, image: asset.seller.image ?? null }} className="size-6 [&_*]:text-[10px]" />
          </span>
          <span className="flex min-w-0 shrink-0 items-center gap-1.5">
            {/* How much the asking price moved at its last change, right beside the price. */}
            {asset.priceChangePct != null && (
              <span title={t("Change since the last price")}>
                <ChangeTag pct={asset.priceChangePct} className="text-[11px]" />
              </span>
            )}
            <span className={cn("whitespace-nowrap font-bold tabular-nums", compact ? "text-sm sm:text-base" : "text-base sm:text-lg")}>
              {asset.priceThb != null ? formatThb(asset.priceThb) : t("Price unavailable")}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
  if (!compare) return card;

  // The toggle sits beside the link, not inside it, so tapping it never
  // opens the listing; the overlay matches the picture's area so it lands
  // in the picture's bottom-right corner. On desktop it rests half-faded so
  // people can find it without it covering the art, and comes up fully on hover.
  return (
    <div className={cn("group/compare relative flex", compare.selected && "[&>a]:border-success")}>
      {card}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
        <button
          type="button"
          onClick={compare.onToggle}
          disabled={compare.disabled}
          aria-pressed={compare.selected}
          aria-label={compare.selected ? t("Comparing") : t("Compare")}
          title={compare.disabled ? t("You can compare up to 5 cards.") : undefined}
          className={cn(
            CHIP,
            "pointer-events-auto absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 py-1.5 transition-[opacity,background-color] disabled:opacity-50",
            compare.selected
              ? "bg-success text-background"
              : "bg-black/70 hover:bg-black/85 md:opacity-60 md:group-hover/compare:opacity-100 md:focus-visible:opacity-100",
          )}
        >
          {compare.selected ? <Check className="size-3" /> : <Scale className="size-3" />}
          {/* Icon only on phones. */}
          <span className="hidden sm:inline">{compare.selected ? t("Comparing") : t("Compare")}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Grader and grade (or "Ungraded"), with JP and Black Label flags. Sits on the
 * picture, so its dimmed parts use white at lower opacity rather than the
 * theme's muted colour, which would vanish on the dark chip in light mode.
 */
function GradeChip({ asset, className }: { asset: AssetSummary; className?: string }) {
  const t = useT();
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {asset.language === "JAPANESE" && (
        <span className="font-semibold text-white/70" title={t("Japanese")}>
          JP ·
        </span>
      )}
      {asset.gradingCompany === "RAW" ? (
        <span className="font-semibold">{t("Ungraded")}</span>
      ) : (
        <>
          <span className="sr-only">{t("Grade:")} </span>
          <span className="text-white/70">{asset.gradingCompany}</span>
          <span className="font-bold">{formatGrade(asset.grade)}</span>
        </>
      )}
      {asset.isBlackLabel && <span className="font-semibold text-black-label">· BL</span>}
    </span>
  );
}
