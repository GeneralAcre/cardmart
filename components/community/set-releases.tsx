"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, ExternalLink, PackageOpen } from "lucide-react";

import { CARD_GAME_BADGE_CLASS } from "@/lib/labels";
import type { SetRelease } from "@/lib/tcg-releases";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import type { Translate } from "@/lib/i18n/translate";
import { GameIcon } from "@/components/ui/game-icon";
import type { CardGame } from "@prisma/client";

type View = "upcoming" | "recent";

// Each game in the same colors as its badge on marketplace cards.
const GAME_CLASS: Record<string, string> = {
  pokemon: CARD_GAME_BADGE_CLASS.POKEMON,
  "one-piece-card-game": CARD_GAME_BADGE_CLASS.ONE_PIECE,
};

// TCG API's game slugs → our game, for its icon (Poké Ball / straw-hat skull).
const GAME_ICON: Record<string, CardGame> = {
  pokemon: "POKEMON",
  "one-piece-card-game": "ONE_PIECE",
};

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function relative(date: string, today: string, t: Translate) {
  const d = daysBetween(today, date);
  if (d === 0) return t("Today");
  if (d === 1) return t("Tomorrow");
  if (d === -1) return t("Yesterday");
  return d > 0 ? t("In {days} days", { days: d }) : t("{days} days ago", { days: -d });
}

export function SetReleases({
  upcoming,
  recent,
  unavailable,
  configured,
  today,
  games,
}: {
  upcoming: SetRelease[];
  recent: SetRelease[];
  unavailable: string[];
  configured: boolean;
  today: string;
  games: { slug: string; label: string }[];
}) {
  const [view, setView] = useState<View>(upcoming.length > 0 ? "upcoming" : "recent");
  const [game, setGame] = useState<string>("all");
  const t = useT();

  const list = useMemo(
    () => (view === "upcoming" ? upcoming : recent).filter((s) => game === "all" || s.game === game),
    [view, game, upcoming, recent],
  );
  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; sets: SetRelease[] }[] = [];
    for (const s of list) {
      const key = s.releaseDate.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.sets.push(s);
      else
        groups.push({
          key,
          label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
          sets: [s],
        });
    }
    return groups;
  }, [list]);

  if (!configured) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        {t("The release calendar needs TCG_API_KEY to be set.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ slug: "all", label: t("All games") }, ...games].map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => setGame(g.slug)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                game === g.slug
                  ? (GAME_CLASS[g.slug] ?? "bg-foreground text-background")
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {GAME_ICON[g.slug] && <GameIcon game={GAME_ICON[g.slug]} size={16} />}
              {t(g.label)}
            </button>
          ))}
        </div>
        <div className="bg-muted flex shrink-0 self-start rounded-lg p-0.5 text-xs font-medium sm:self-auto">
          {(
            [
              { key: "upcoming", label: `${t("Upcoming")} (${upcoming.length})`, icon: CalendarClock },
              { key: "recent", label: `${t("Just released")} (${recent.length})`, icon: CalendarDays },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
                view === v.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {unavailable.length > 0 && (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
          {t("Couldn't load {games} right now (the data source may be at its daily limit). They'll reappear automatically.", {
            games: unavailable.map((g) => t(g)).join(", "),
          })}
        </p>
      )}

      {list.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm">
          <PackageOpen className="size-6" />
          {view === "upcoming" ? t("No announced upcoming sets for this game.") : t("No sets released in the last 90 days.")}
        </div>
      ) : (
        // One section per month, each a grid of tiles, soonest first: the artwork
        // big on top with the date and countdown on it, then name, game and count.
        <div className="flex flex-col gap-8">
          {byMonth.map((month) => (
            <section key={month.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold whitespace-nowrap">{month.label}</h3>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {t("{count} sets", { count: month.sets.length })}
                </span>
                <span aria-hidden className="bg-border h-px flex-1" />
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {month.sets.map((s) => {
                  const days = daysBetween(today, s.releaseDate);
                  const soon = days >= 0 && days <= 7;
                  const day = new Date(`${s.releaseDate}T00:00:00Z`);
                  return (
                    <li key={`${s.game}-${s.id}`}>
                      <a
                        href={s.tcgplayerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={formatDay(s.releaseDate)}
                        className="bg-card hover:border-foreground/30 group flex h-full flex-col overflow-hidden rounded-2xl border transition-colors"
                      >
                        <div className="relative aspect-[4/3]">
                          <SetArtwork imageUrl={s.imageUrl} iconUrl={s.iconUrl} />
                          {/* A small calendar page: day number over the month. */}
                          <span className="bg-background/85 absolute top-2 left-2 flex w-11 flex-col items-center rounded-lg py-1 leading-none backdrop-blur-sm">
                            <span className="text-lg font-bold tabular-nums">{day.getUTCDate()}</span>
                            <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                              {day.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "absolute top-2 right-2 rounded-md px-1.5 py-1 text-[11px] leading-none font-semibold backdrop-blur-sm",
                              soon ? "bg-success text-success-foreground" : "bg-background/85 text-foreground",
                            )}
                          >
                            {relative(s.releaseDate, today, t)}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-3">
                          <span className="line-clamp-2 text-sm leading-snug font-semibold">{s.name}</span>
                          <span className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="flex items-center gap-1.5">
                              {GAME_ICON[s.game] && <GameIcon game={GAME_ICON[s.game]} size={14} />}
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold",
                                  GAME_CLASS[s.game] ?? "bg-muted text-foreground",
                                )}
                              >
                                {t(s.gameLabel)}
                              </span>
                            </span>
                            {s.cardCount ? t("{count} cards listed so far", { count: s.cardCount }) : null}
                            <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-[11px]">
        {t("Release dates come from TCGplayer's catalogue via TCG API, refreshed every 12 hours. Upcoming sets are announced products; their card lists fill in as cards are revealed. Click a set to see its products on TCGplayer.")}
      </p>
    </div>
  );
}

/**
 * Product artwork, falling back to the set icon, then a placeholder. TCG API
 * sometimes returns artwork URLs that 404 on TCGplayer's image server, so
 * each source is tried in turn on load error rather than trusted blindly.
 */
function SetArtwork({ imageUrl, iconUrl }: { imageUrl: string | null; iconUrl: string | null }) {
  const sources = [imageUrl, iconUrl].filter((u): u is string => Boolean(u));
  const [index, setIndex] = useState(0);
  const src = sources[index];
  const isIcon = src != null && src === iconUrl;

  return (
    // Fills the tile's picture area; a set icon (small, often with transparency)
    // is shown whole with room around it instead of being stretched.
    <div className="bg-muted absolute inset-0 flex items-center justify-center overflow-hidden">
      {src ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          unoptimized
          onError={() => setIndex((i) => i + 1)}
          className={isIcon ? "object-contain p-8" : "object-cover transition-transform duration-300 group-hover:scale-[1.03]"}
        />
      ) : (
        <PackageOpen className="text-muted-foreground size-7" />
      )}
    </div>
  );
}
