"use client";

import { Crown } from "lucide-react";

import { TOP_TIER_SELLER } from "@/lib/seller-tier";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

/** Shown next to a seller's name when they meet the Top Tier rule (lib/seller-tier.ts). Renders nothing otherwise. */
export function TopTierBadge({ topTier, className }: { topTier: boolean; className?: string }) {
  const t = useT();
  if (!topTier) return null;
  return (
    <span
      className={cn("bg-success/15 text-success inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold", className)}
      title={t("Top Tier Seller: {sales}+ completed sales, {rating}+ stars from {reviews}+ reviews, ID verified", {
        sales: TOP_TIER_SELLER.sales,
        rating: TOP_TIER_SELLER.rating,
        reviews: TOP_TIER_SELLER.reviews,
      })}
    >
      <Crown className="size-3.5" />
      {t("Top Tier Seller")}
    </span>
  );
}
