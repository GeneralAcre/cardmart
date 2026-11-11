"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Images, Scale } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { useMoney } from "@/components/currency-provider";
import type { AssetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayImage, realPhotos } from "@/lib/card-image";
import { useT } from "@/components/landing/language-provider";
import { RarityTag } from "@/components/item/rarity-badge";
import { ChangeTag } from "@/components/ui/change-tag";
import { UserAvatar } from "@/components/messages/user-avatar";

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
  const money = useMoney();
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

        {/* Price movement and photo count sit over the artwork. */}
        {asset.priceChangePct != null && (
          // A solid green or red chip with its own text colour: red text on a dark
          // chip over artwork was too faint to read. Both pairs pass AA contrast.
          <span
            className={cn(
              CHIP,
              "absolute right-2.5 top-2.5 py-1.5 shadow-sm",
              asset.priceChangePct >= 0 ? "bg-success-fill" : "bg-destructive",
            )}
            title={t("Change since the last price")}
          >
            <ChangeTag
              pct={asset.priceChangePct}
              className={cn("text-[11px] leading-none", asset.priceChangePct >= 0 ? "text-success-fill-foreground" : "text-destructive-foreground")}
            />
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
        {/* One line on every card, so the set line and price line up across a row with no gaps.
            A long name ends in "…" and shows in full on hover. */}
        <h3 title={asset.name} className={cn("truncate font-semibold", compact ? "text-[13px]" : "text-sm")}>{asset.name}</h3>
        {/* The set, with the rarity on the right: the same spot on every card, but a
            coloured outline rather than a filled tag, so the price stays the headline. */}
        <div className="text-muted-foreground flex min-w-0 items-center justify-between gap-2 text-xs">
          <span className="truncate">{asset.subtitle}</span>
          {asset.rarity && <RarityTag rarity={asset.rarity} />}
        </div>

        {/* Bottom row: the seller's picture on the left (name on hover), the price on the right. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span title={sellerName} aria-label={t("Seller: {name}", { name: sellerName })}>
            <UserAvatar user={{ name: sellerName, handle: null, image: asset.seller.image ?? null }} className="size-6 [&_*]:text-[10px]" />
          </span>
          {/* The price, the boldest thing on the card. */}
          <span className={cn("shrink-0 whitespace-nowrap font-bold tabular-nums", compact ? "text-sm sm:text-base" : "text-base sm:text-lg")}>
            {asset.priceThb != null ? money(asset.priceThb) : t("Price unavailable")}
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
              ? "bg-success-fill text-success-fill-foreground"
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

