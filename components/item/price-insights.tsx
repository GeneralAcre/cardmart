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
        <div className="bg-secondary text-foreground flex size-8 items-center justify-center rounded-md">
          <Lightbulb className="size-4" />
        </div>
        <span className="eyebrow text-success text-sm">{t("Price Insights")}</span>
      </div>
      {/* Side by side on wider screens so the row is filled; stacked on phones.
          The 1px gap over a border-coloured background draws the dividers, so
          they stay right when the cards wrap onto a second row. */}
      <ul
        className={cn(
          "bg-border grid gap-px",
          (insights.length === 2 || insights.length === 4) && "sm:grid-cols-2",
          (insights.length === 3 || insights.length >= 5) && "sm:grid-cols-3",
        )}
      >
        {insights.map((insight, i) => {
          const Icon = TONE_ICON[insight.tone];
          // With 5 in three columns, the last one stretches over the empty cell.
          const fillsRow = insights.length === 5 && i === 4;
          return (
            <li key={insight.title} className={cn("bg-card flex gap-3 p-4", fillsRow && "sm:col-span-2")}>
              <Icon
                className={cn(
                  "mt-1 size-5 shrink-0",
                  insight.tone === "up" && "text-success",
                  insight.tone === "down" && "text-destructive",
                  insight.tone === "neutral" && "text-muted-foreground",
                )}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-semibold">{insight.title}</span>
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
