import Image from "next/image";
import type { CardGame } from "@prisma/client";

import { cn } from "@/lib/utils";

// The artwork lives in public/. The One Piece file is a wide canvas, so it is
// cropped to the skull and crossbones (about 1.15 wide for every 1 tall).
const ONE_PIECE_ASPECT = 1.15;

/**
 * The icon for each game: the Poké Ball for Pokémon, the straw-hat skull for
 * One Piece. `size` is the height in pixels. Used wherever a game is named,
 * except on the game tag on the cards themselves.
 */
export function GameIcon({ game, size = 20, className }: { game: CardGame; size?: number; className?: string }) {
  if (game === "POKEMON") {
    return (
      <span aria-hidden className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
        <Image src="/Pokemon-Logo.webp" alt="" fill sizes={`${size * 2}px`} className="object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 overflow-hidden", className)}
      style={{ width: Math.round(size * ONE_PIECE_ASPECT), height: size }}
    >
      <Image src="/One-Piece-Logo.png" alt="" fill sizes={`${size * 3}px`} className="object-cover" />
    </span>
  );
}
