"use client";

import { Lightbulb, Minus, TrendingDown, TrendingUp } from "lucide-react";

import type { PriceInsight } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

const TONE_ICON = { up: TrendingUp, down: TrendingDown, neutral: Minus } as const;

export function PriceInsights({ insights }: { insights: PriceInsight[] }) {
  const t = useT();
  if (insights.length === 0) return null;

  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2 border-b p-4">
        <div className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-md">
          <Lightbulb className="size-3.5" />
        </div>
        <span className="eyebrow text-foreground">{t("Price Insights")}</span>
      </div>
      <ul className="divide-y">
        {insights.map((insight) => {
          const Icon = TONE_ICON[insight.tone];
          return (
            <li key={insight.title} className="flex gap-3 p-4">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  insight.tone === "up" && "text-success",
                  insight.tone === "down" && "text-destructive",
                  insight.tone === "neutral" && "text-muted-foreground",
                )}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{insight.title}</span>
                <span className="text-muted-foreground text-xs">{insight.detail}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground border-t px-4 py-3 text-[11px]">
        {t("Based only on real CardMart sales and listings, this listing's own price history and PSA population data.")}
      </p>
    </div>
  );
}
