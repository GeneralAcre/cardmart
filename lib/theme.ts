import type { AssetCategory } from "@prisma/client";
import { Sparkles, Trophy, Gem, BookOpen, type LucideIcon } from "lucide-react";

export const CARD_GRADIENTS: [string, string][] = [
  ["#f97316", "#db2777"],
  ["#6366f1", "#06b6d4"],
  ["#059669", "#84cc16"],
  ["#7c3aed", "#ec4899"],
  ["#0ea5e9", "#22d3ee"],
  ["#f59e0b", "#ef4444"],
  ["#8b5cf6", "#3b82f6"],
  ["#10b981", "#14b8a6"],
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
