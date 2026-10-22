"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, LayoutGrid } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { Button } from "@/components/ui/button";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

type Group = "series" | "cards";
type SizeBy = "mcap" | "avg";

interface Tile {
  key: string;
  label: string;
  /** Tile area. */
  size: number;
  /** Value-weighted % change over the period, or null with no earlier price to compare. */
  change: number | null;
  count: number;
  href?: string;
  series?: string;
  /** The card whose picture represents this tile: itself, or a series' most valuable card. */
  cover: LeaderboardRow;
  /** The cards inside the tile, so smaller tiles can be merged into "+N more". */
  rows: LeaderboardRow[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d"];
/** Change at which a tile reaches full colour; anything bigger is capped. */
const FULL_COLOR_PCT = 20;
/**
 * Smallest share of the map any tile gets. A series worth 1% of the market
 * would otherwise be a sliver too thin to label or tap; the floor keeps it
 * readable, and its label still shows the real value.
 */
const MIN_TILE_SHARE = 0.035;
/**
 * Most tiles the map draws, by its width: a phone fits far fewer readable
 * tiles than a desktop. Smaller ones are merged into a single "+N more" tile.
 */
const maxTiles = (width: number) => (width < 480 ? 8 : 10);

/**
 * Value-weighted change for a set of cards: (today's total − the total at the
 * start of the period) / the start total, using only cards that have an
 * earlier price to compare. One expensive card moving counts for more than a
 * cheap one — the same idea as a market-cap-weighted index.
 */
function weightedChange(rows: LeaderboardRow[], period: LeaderboardPeriod): number | null {
  let now = 0;
  let before = 0;
  for (const r of rows) {
    const c = r.change[period];
    if (c == null) continue;
    now += r.priceThb;
    before += r.priceThb / (1 + c / 100);
  }
  return before > 0 ? ((now - before) / before) * 100 : null;
}

/** Squarified treemap (Bruls, Huizing & van Wijk) — keeps tiles as close to square as possible. */
function squarify(values: number[], rect: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const scale = (rect.w * rect.h) / total;
  const areas = values.map((v) => v * scale);
  const out: Rect[] = [];
  let { x, y, w, h } = rect;
  let i = 0;

  const worst = (row: number[], side: number) => {
    const sum = row.reduce((a, b) => a + b, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  while (i < areas.length) {
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) {
      row.push(areas[j]);
      j++;
    }
    const rowArea = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const colW = rowArea / h;
      let yy = y;
      for (const a of row) {
        out.push({ x, y: yy, w: colW, h: a / colW });
        yy += a / colW;
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = rowArea / w;
      let xx = x;
      for (const a of row) {
        out.push({ x: xx, y, w: a / rowH, h: rowH });
        xx += a / rowH;
      }
      y += rowH;
      h -= rowH;
    }
    i = j;
  }
  return out;
}
// Each tile mixes green or red into the page's muted grey, so the readable text colour depends on the theme.
// Text colours for the two themes: dark ink on light fills, white on deep ones.
const INK_DARK = "#0a0a0a";
const INK_LIGHT = "#ffffff";

/**
 * A tile's fill, plus its text colour on each theme. Both inks are passed to
 * CSS (see .heat-tile in globals.css), which picks the one for the theme the
 * page is actually showing, so the text is right whichever theme is on.
 */
function tileStyle(change: number | null): { background: string; inkOnDark: string; inkOnLight: string } {
  if (change == null || Math.abs(change) < 0.005) return { background: "var(--muted)", inkOnDark: INK_LIGHT, inkOnLight: INK_DARK };
  const strength = Math.min(Math.abs(change) / FULL_COLOR_PCT, 1);
  const pct = Math.round(30 + strength * 70);
  const color = change > 0 ? "var(--success)" : "var(--destructive)";
  return {
    background: `color-mix(in oklab, ${color} ${pct}%, var(--muted))`,
    inkOnDark: change > 0 && pct >= 60 ? INK_DARK : INK_LIGHT,
    inkOnLight: pct < 55 ? INK_DARK : INK_LIGHT,
  };
}

function formatChange(change: number | null) {
  if (change == null) return "—";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
}

/** `compact` gives a shorter map for sitting inside another page's panel. */
export function MarketHeatmap({
  rows,
  compact = false,
  period: controlledPeriod,
  onPeriodChange,
}: {
  rows: LeaderboardRow[];
  compact?: boolean;
  /** When the page owns the period (the Market page shares one picker with the movers), pass it here and the map hides its own. */
  period?: LeaderboardPeriod;
  onPeriodChange?: (period: LeaderboardPeriod) => void;
}) {
  const router = useRouter();
  const [ownPeriod, setPeriod] = useState<LeaderboardPeriod>("7d");
  const period = controlledPeriod ?? ownPeriod;
  const [group, setGroup] = useState<Group>("series");
  const [sizeBy, setSizeBy] = useState<SizeBy>("mcap");
  const [series, setSeries] = useState<string | null>(null);
  const tr = useT();

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = width < 640 ? (compact ? 360 : 440) : compact ? 480 : 580;

  const tiles: Tile[] = useMemo(() => {
    const cardTiles = (list: LeaderboardRow[]): Tile[] =>
      list.map((r) => ({
        key: r.id,
        label: r.name,
        size: r.priceThb,
        change: r.change[period],
        count: 1,
        href: `/item/${r.id}`,
        cover: r,
        rows: [r],
      }));

    if (series != null) return cardTiles(rows.filter((r) => r.subtitle === series));
    if (group === "cards") return cardTiles(rows);

    const bySeries = new Map<string, LeaderboardRow[]>();
    for (const r of rows) bySeries.set(r.subtitle, [...(bySeries.get(r.subtitle) ?? []), r]);
    return [...bySeries.entries()].map(([name, list]) => {
      const mcap = list.reduce((a, r) => a + r.priceThb, 0);
      return {
        key: name,
        label: name,
        size: sizeBy === "mcap" ? mcap : mcap / list.length,
        change: weightedChange(list, period),
        count: list.length,
        series: name,
        cover: list.reduce((a, b) => (b.priceThb > a.priceThb ? b : a)),
        rows: list,
      };
    });
  }, [rows, period, group, sizeBy, series]);

  // The biggest tiles (maxTiles, by width) get their own space; everything smaller shares
  // one "+N more" tile, sized and coloured from all of them, so the map still
  // adds up to the whole market without dozens of unreadable slivers.
  const sorted = useMemo(() => {
    const bySize = [...tiles].filter((t) => t.size > 0).sort((a, b) => b.size - a.size);
    const limit = maxTiles(width);
    if (bySize.length <= limit) return bySize;
    const shown = bySize.slice(0, limit - 1);
    const rest = bySize.slice(limit - 1);
    const restRows = rest.flatMap((t) => t.rows);
    const others: Tile = {
      key: "__others",
      label: tr("+{count} more", { count: rest.length }),
      // Market cap adds up; an average doesn't, so series sized by "Avg price" use the average of the rest.
      size: rest.reduce((a, t) => a + t.size, 0) / (series == null && group === "series" && sizeBy === "avg" ? rest.length : 1),
      change: weightedChange(restRows, period),
      count: restRows.length,
      cover: restRows.reduce((a, b) => (b.priceThb > a.priceThb ? b : a)),
      rows: restRows,
    };
    return [...shown, others];
  }, [tiles, sizeBy, group, series, period, tr, width]);
  const rects = useMemo(() => {
    const total = sorted.reduce((a, t) => a + t.size, 0);
    const layoutSizes = sorted.map((t) => Math.max(t.size, total * MIN_TILE_SHARE));
    // "+N more" can add up to more than any one series; drawn at that size it lands mid-map and
    // breaks the biggest-first order. Cap it at the smallest named tile so it always sits last,
    // bottom-right — its label still shows the real change.
    const last = sorted.length - 1;
    if (last > 0 && sorted[last].key === "__others") layoutSizes[last] = Math.min(layoutSizes[last], layoutSizes[last - 1]);
    return squarify(layoutSizes, { x: 0, y: 0, w: width, h: height });
  }, [sorted, width, height]);

  const ranked = [...tiles].filter((t) => t.change != null).sort((a, b) => b.change! - a.change!);
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const biggest = sorted[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {series != null ? (
            <Button variant="outline" size="sm" onClick={() => setSeries(null)}>
              <ChevronLeft /> {tr("All series")}
            </Button>
          ) : (
            <Segmented
              value={group}
              onChange={(v) => setGroup(v as Group)}
              options={[
                { value: "series", label: tr("By series") },
                { value: "cards", label: tr("By card") },
              ]}
            />
          )}
          {series == null && group === "series" && (
            <Segmented
              value={sizeBy}
              onChange={(v) => setSizeBy(v as SizeBy)}
              options={[
                { value: "mcap", label: tr("Market cap") },
                { value: "avg", label: tr("Avg price") },
              ]}
            />
          )}
          {series != null && <span className="truncate text-sm font-semibold">{series}</span>}
        </div>
        {!onPeriodChange && (
          <Segmented value={period} onChange={(v) => setPeriod(v as LeaderboardPeriod)} options={PERIODS.map((p) => ({ value: p, label: p }))} />
        )}
      </div>

      {tiles.length > 0 && !compact && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label={`${tr("Top gainer")} · ${period}`} tile={best && best.change! > 0 ? best : null} />
          <Stat label={`${tr("Top loser")} · ${period}`} tile={worst && worst.change! < 0 ? worst : null} />
          <Stat label={tr("Largest mcap")} tile={biggest ?? null} />
        </div>
      )}

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border" style={{ height }}>
        {sorted.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
            <LayoutGrid className="size-6" />
            {tr("No cards for sale yet.")}
          </div>
        ) : (
          width > 0 &&
          sorted.map((t, i) => {
            const r = rects[i];
            const { background, inkOnDark, inkOnLight } = tileStyle(t.change);
            const minSide = Math.min(r.w, r.h);
            const big = r.w > 150 && r.h > 100;
            // As big as the tile allows while always leaving room under it for a
            // two-line label, the change, the gap and the padding (covers are 3:4).
            const textReserve = big ? 100 : 72;
            const coverWidth = Math.floor(Math.min(280, r.w * 0.6, (r.h - textReserve) * 0.75));
            const showCover = coverWidth >= 56;
            // Every tile gets a label and its change. Scale down for narrow
            // treemap cells instead of hiding the text behind a size cutoff.
            const fontSize = minSide < 44 ? 8 : minSide < 64 ? 9 : minSide < 90 ? 10 : undefined;
            const clickable = Boolean(t.href || t.series);
            return (
              <button
                key={t.key}
                type="button"
                disabled={!clickable}
                onClick={() => (t.series ? setSeries(t.series) : t.href && router.push(t.href))}
                title={`${t.label}\n${formatChange(t.change)} (${period})`}
                className={cn(
                  "heat-tile absolute flex flex-col items-center justify-center overflow-hidden border border-black/40 p-1 text-center transition-[filter] hover:brightness-110",
                )}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, background, "--ink-dark": inkOnDark, "--ink-light": inkOnLight } as React.CSSProperties}
              >
                {showCover && <CoverThumb card={t.cover} className="mb-2 shadow-md" style={{ width: coverWidth }} />}
                <span
                  className={cn("line-clamp-2 leading-tight font-semibold", big ? "text-sm" : "text-[11px]")}
                  style={fontSize ? { fontSize } : undefined}
                >
                    {t.label}
                </span>
                <span
                  className={cn("font-bold tabular-nums", big ? "text-base" : "text-[11px]")}
                  style={fontSize ? { fontSize } : undefined}
                >
                    {formatChange(t.change)}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-[11px] xl:flex-nowrap">
        <div className="flex shrink-0 items-center gap-2">
          <span>−{FULL_COLOR_PCT}%</span>
          <div
            className="h-2 w-40 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--destructive), color-mix(in oklab, var(--destructive) 30%, var(--muted)), var(--muted), color-mix(in oklab, var(--success) 30%, var(--muted)), var(--success))",
            }}
          />
          <span>+{FULL_COLOR_PCT}%</span>
        </div>
        <p className="max-w-xl xl:max-w-none xl:truncate">
          {series == null && group === "series"
            ? tr("Each tile is a card series (set). Size = total value listed (market cap) or average price; colour = value-weighted price change. Click a series to see its cards.")
            : tr("Each tile is a card for sale. Size = asking price; colour = price change. Click a card to open it.")}
        </p>
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="bg-card flex shrink-0 rounded-lg border p-0.5 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
            value === o.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A card's real verification photo, or its generated artwork when it has none. */
function CoverThumb({ card, className, style }: { card: LeaderboardRow; className?: string; style?: import("react").CSSProperties }) {
  return (
    <span style={style} className={cn("relative block aspect-[3/4] shrink-0 overflow-hidden rounded-md border border-black/30", className)}>
      {card.photoUrl ? (
        <Image src={card.photoUrl} alt="" fill sizes="280px" className="object-cover" />
      ) : (
        <CardArt
          themeIndex={card.themeIndex}
          category={card.category}
          gradingCompany={card.gradingCompany}
          grade={card.grade}
          isBlackLabel={card.isBlackLabel}
          bordered={false}
        />
      )}
    </span>
  );
}

function Stat({ label, tile }: { label: string; tile: Tile | null }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
      {tile && <CoverThumb card={tile.cover} className="w-10 sm:w-12" />}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-muted-foreground truncate text-[10px] sm:text-xs">{label}</span>
        {tile ? (
          <>
            <span className="line-clamp-2 text-xs leading-tight font-semibold sm:truncate sm:text-sm">{tile.label}</span>
            <span
              className={cn(
                "text-xs font-bold tabular-nums sm:text-sm",
                tile.change! > 0 ? "text-success" : "text-destructive",
              )}
            >
            {formatChange(tile.change)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
    </div>
  );
}
