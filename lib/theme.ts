import type { AssetCategory } from "@prisma/client";
import { Sparkles, Trophy, Gem, BookOpen, type LucideIcon } from "lucide-react";

// Neutral cream-to-charcoal swatches — warmth and value vary slightly per
// index for scannable variety in a grid, without introducing hue/color.
export const CARD_GRADIENTS: [string, string][] = [
  ["#f4ecd8", "#1c1917"],
  ["#eee6d3", "#242220"],
  ["#f7f3ea", "#141414"],
  ["#e8e0cd", "#2a2620"],
  ["#f0e9db", "#1a1a1a"],
  ["#ece3d0", "#211f1c"],
  ["#f5efe2", "#181614"],
  ["#e6ddc8", "#252220"],
];

export const CATEGORY_ICONS: Record<AssetCategory, LucideIcon> = {
  TRADING_CARD: Sparkles,
  SPORTS_CARD: Trophy,
  AMULET: Gem,
  COMIC: BookOpen,
};

export function gradientFor(themeIndex: number): [string, string] {
  return CARD_GRADIENTS[themeIndex % CARD_GRADIENTS.length];
}

/** Deterministic cosmetic theme index derived from a serial number. */
export function themeIndexForSerial(serial: string): number {
  let hash = 0;
  for (let i = 0; i < serial.length; i++) {
    hash = (hash * 31 + serial.charCodeAt(i)) >>> 0;
  }
  return hash % CARD_GRADIENTS.length;
}
