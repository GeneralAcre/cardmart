"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Activity, LayoutGrid, TrendingDown, TrendingUp } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { MarketHeatmap } from "@/components/marketplace/market-heatmap";
import { formatGrade } from "@/lib/format";
import { useMoney } from "@/components/currency-provider";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ChangeTag } from "@/components/ui/change-tag";
import { useT } from "@/components/landing/language-provider";

const PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d"];
const MOVERS_SHOWN = 3;
/** Smaller changes than this are rounding noise, not a move. */
const MIN_MOVE_PCT = 0.05;

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: typeof Activity }[];
}) {
  return (
    <div className="bg-card flex shrink-0 rounded-lg border p-0.5 text-xs font-medium">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
            value === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {Icon && <Icon className="size-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

function Thumb({ row }: { row: LeaderboardRow }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span className="card-stage relative block aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-md border">
      {row.photoUrl && !imageFailed ? (
        <Image
          src={row.photoUrl}
          alt=""
          fill
          sizes="32px"
          className="object-contain p-0.5"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <CardArt
          themeIndex={row.themeIndex}
          category={row.category}
          gradingCompany={row.gradingCompany}
          grade={row.grade}
          isBlackLabel={row.isBlackLabel}
          bordered={false}
          showGrade={false}
        />
      )}
    </span>
  );
}

/** One ranked list — top gainers or top losers for the chosen period. */
function MoversList({
  title,
  icon: Icon,
  tone,
  rows,
  period,
}: {
  title: string;
  icon: typeof TrendingUp;
  tone: "up" | "down";
  rows: LeaderboardRow[];
  period: LeaderboardPeriod;
}) {
  const money = useMoney();
  const t = useT();
  return (
    <section
      className="bg-card relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border"
      style={{
        backgroundImage: "radial-gradient(90% 60% at 0% 0%, color-mix(in oklab, var(--foreground) 9%, transparent), transparent 65%)",
      }}
    >
      <h3 className="eyebrow text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5">
        <Icon className={cn("size-3.5", tone === "up" ? "text-success" : "text-destructive")} />
        {t(title)}
      </h3>
      {/* Always MOVERS_SHOWN slots of the same height: a missing mover leaves an empty slot, so the box never changes size. */}
      <ol className="flex flex-1 flex-col divide-y">
        {Array.from({ length: MOVERS_SHOWN }, (_, i) => {
          const row = rows[i];
          if (!row) {
            return (
              <li key={`empty-${i}`} className="text-muted-foreground flex h-[4.5rem] items-center px-4 text-sm">
                {i === 0 && rows.length === 0 ? t("No price moves in this period yet.") : <span aria-hidden>—</span>}
              </li>
            );
          }
          const change = row.change[period]!;
          return (
            <li key={row.id} className="h-[4.5rem]">
              <Link href={`/item/${row.id}`} className="hover:bg-secondary/60 flex h-full w-full items-center gap-3 px-4 transition-colors">
                <Thumb row={row} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{row.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {row.gradingCompany === "RAW" ? t("Raw") : `${row.gradingCompany} ${formatGrade(row.grade)}`} ·{" "}
                    <span className="tabular-nums">{money(row.priceThb)}</span>
                  </span>
                </span>
                <ChangeTag pct={change} className="text-sm" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The market at a glance, above the Market page's grid: the biggest price
 * movers, or a heatmap of every card for sale. Built from real price
 * snapshots. Stats, activity and set releases live on Community → News.
 */
export function MarketPulse({ rows }: { rows: LeaderboardRow[] }) {
  // Open on the first period that actually has price moves, so the panel
  // never starts as two empty lists while older moves exist.
  const [period, setPeriod] = useState<LeaderboardPeriod>(
    () => (["7d", "30d", "24h"] as const).find((p) => rows.some((r) => Math.abs(r.change[p] ?? 0) >= MIN_MOVE_PCT)) ?? "7d",
  );
  const t = useT();

  const moved = rows.filter((r) => r.change[period] != null && Math.abs(r.change[period]!) >= MIN_MOVE_PCT);
  const gainers = moved.filter((r) => r.change[period]! > 0).sort((a, b) => b.change[period]! - a.change[period]!).slice(0, MOVERS_SHOWN);
  const losers = moved.filter((r) => r.change[period]! < 0).sort((a, b) => a.change[period]! - b.change[period]!).slice(0, MOVERS_SHOWN);

  const periodPicker = (
    <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
  );

  const sectionTitle = (icon: typeof Activity, label: string) => {
    const Icon = icon;
    return (
      <div className="flex items-center gap-2">
        <div className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-md">
          <Icon className="size-3.5" />
        </div>
        <h2 className="eyebrow text-foreground text-sm">{label}</h2>
      </div>
    );
  };

  // Side by side on wide screens (movers 20%, heatmap 80% of the full width); stacked on phones. One period picker, top right, drives both.
  return (
    <section className="flex w-full flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-[1]">
        <div className="flex h-9 items-center justify-between gap-3">
          {sectionTitle(Activity, t("Trending"))}
          {/* Phones stack Trending above the heatmap, so the shared period picker sits up here; on wide screens it stays by the heatmap. */}
          <div className="lg:hidden">{periodPicker}</div>
        </div>
        <div className="flex flex-col gap-3">
          <MoversList title="Top gainers" icon={TrendingUp} tone="up" rows={gainers} period={period} />
          <MoversList title="Top losers" icon={TrendingDown} tone="down" rows={losers} period={period} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:flex-[4]">
        <div className="flex h-9 items-center justify-between gap-3">
          {sectionTitle(LayoutGrid, t("Heatmap"))}
          <div className="hidden lg:block">{periodPicker}</div>
        </div>
        <MarketHeatmap rows={rows} compact period={period} onPeriodChange={setPeriod} />
      </div>
    </section>
  );
}
