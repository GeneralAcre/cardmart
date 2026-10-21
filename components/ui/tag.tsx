import { cn } from "@/lib/utils";

/**
 * A small, read-only coloured label for a card attribute: rarity, game,
 * language. One size everywhere; the colour comes in through `className`
 * from the shared palettes (RARITY_STYLE in lib/rarity.ts,
 * CARD_GAME_BADGE_CLASS / CARD_LANGUAGE_BADGE_CLASS in lib/labels.ts), the
 * same ones the Market filter pills turn when picked.
 *
 * Tag is for attributes. Status ("Up for Auction") uses Badge; toggles are
 * pills (see FilterPill).
 */
export function Tag({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] leading-none font-extrabold tracking-wide whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
