"use client";

import type { CardRarity } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/tag";
import { RARITIES, RARITY_BORDER, RARITY_SHORT, RARITY_STYLE } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

// RARITIES is listed rarest first, so the rarest tier fills the whole meter.
const TOTAL = RARITIES.length;

/**
 * How rare this card is: the tag (SAR, SEC, …), a meter that fills the rarer
 * it gets, and the plain-English name. Shows nothing when the rarity isn't
 * known yet, rather than a guess.
 */
export function RarityBadge({ rarity }: { rarity: CardRarity | null | undefined }) {
  const { tr: t } = useLanguage();
  if (!rarity) return null;
  const index = RARITIES.findIndex((r) => r.value === rarity);
  const info = RARITIES[index];
  const filled = TOTAL - index;

  return (
    <Badge
      variant="outline"
      className="gap-2 rounded-md py-1"
      title={`${t(info.label)}: ${t(info.description)}`}
      aria-label={`${t("Rarity")}: ${t(info.label)}`}
    >
      <span className={cn("inline-flex w-10 justify-center rounded py-0.5 text-[11px] leading-none font-extrabold", RARITY_STYLE[rarity])}>{RARITY_SHORT[rarity]}</span>
      <span aria-hidden className="flex items-center gap-[3px]">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={cn("size-1.5 rounded-full", i < filled ? "bg-highlight" : "bg-foreground/15")} />
        ))}
      </span>
      <span className="text-muted-foreground font-normal">{t(info.label)}</span>
    </Badge>
  );
}

/**
 * The rarity as a small coloured tag for a card in a grid: just the code (SAR),
 * short enough to sit beside the price. Hover for the full name.
 */
export function RarityTag({
  rarity,
  quiet = false,
}: {
  rarity: CardRarity;
  /**
   * An outline in the rarity's colour with plain text, instead of a filled tag,
   * for places where rarity is a detail and something else (the price) should lead.
   */
  quiet?: boolean;
}) {
  const { tr: t } = useLanguage();
  const info = RARITIES.find((r) => r.value === rarity)!;
  return (
    <Tag
      title={`${t(info.label)}: ${t(info.description)}`}
      // Fixed width, so every rarity's tag is the same size however short its code.
      className={cn(
        "w-11 px-0",
        quiet ? cn("text-foreground/80 border font-semibold", RARITY_BORDER[rarity]) : RARITY_STYLE[rarity],
      )}
    >
      {RARITY_SHORT[rarity]}
    </Tag>
  );
}
