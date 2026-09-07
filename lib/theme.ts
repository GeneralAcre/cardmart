import type { AssetCategory } from "@prisma/client";
import { Sparkles, Trophy, Gem, BookOpen, type LucideIcon } from "lucide-react";

// Off-white swatches — warmth varies slightly per index for scannable
// variety in a grid, while staying light so card art reads easily at a
// glance instead of resolving to a dark tile.
export const CARD_GRADIENTS: [string, string][] = [
  ["#ffffff", "#f2efe6"],
  ["#fdfdfc", "#eef0f2"],
  ["#ffffff", "#f5efe2"],
  ["#fbfbfa", "#e9edf1"],
  ["#fefefe", "#f1ece1"],
  ["#fcfcfb", "#eaeef0"],
  ["#ffffff", "#f4f0e6"],
  ["#fdfdfc", "#ecefee"],
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
