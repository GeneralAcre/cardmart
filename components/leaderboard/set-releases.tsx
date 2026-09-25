"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, ExternalLink, PackageOpen } from "lucide-react";

import type { SetRelease } from "@/lib/tcg-releases";
import { cn } from "@/lib/utils";

type View = "upcoming" | "recent";

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

function relative(date: string, today: string) {
  const d = daysBetween(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return d > 0 ? `In ${d} days` : `${-d} days ago`;
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

  const list = useMemo(
    () => (view === "upcoming" ? upcoming : recent).filter((s) => game === "all" || s.game === game),
    [view, game, upcoming, recent],
  );
  const byDay = useMemo(() => {
    const groups: { date: string; sets: SetRelease[] }[] = [];
    for (const s of list) {
      const last = groups[groups.length - 1];
      if (last?.date === s.releaseDate) last.sets.push(s);
      else groups.push({ date: s.releaseDate, sets: [s] });
    }
    return groups;
  }, [list]);

  if (!configured) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        The release calendar needs TCG_API_KEY to be set.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ slug: "all", label: "All games" }, ...games].map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => setGame(g.slug)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                game === g.slug ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="bg-muted flex shrink-0 self-start rounded-lg p-0.5 text-xs font-medium sm:self-auto">
          {(
            [
              { key: "upcoming", label: `Upcoming (${upcoming.length})`, icon: CalendarClock },
              { key: "recent", label: `Just released (${recent.length})`, icon: CalendarDays },
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
          Couldn&apos;t load {unavailable.join(", ")} right now (the data source may be at its daily limit). They&apos;ll
          reappear automatically.
        </p>
      )}

      {byDay.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm">
          <PackageOpen className="size-6" />
          {view === "upcoming" ? "No announced upcoming sets for this game." : "No sets released in the last 90 days."}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {byDay.map((day) => (
            <section key={day.date} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2 border-b pb-2">
                <h3 className="text-sm font-semibold">{formatDay(day.date)}</h3>
                <span
                  className={cn(
                    "text-xs font-medium",
                    daysBetween(today, day.date) >= 0 && daysBetween(today, day.date) <= 7 ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {relative(day.date, today)}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {day.sets.map((s) => (
                  <li key={`${s.game}-${s.id}`}>
                    <a
                      href={s.tcgplayerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-3 transition-colors"
                    >
                      <div className="bg-muted relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                        {s.imageUrl ? (
                          <Image src={s.imageUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                        ) : s.iconUrl ? (
                          <Image src={s.iconUrl} alt="" width={32} height={32} className="object-contain" unoptimized />
                        ) : (
                          <PackageOpen className="text-muted-foreground size-5" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="line-clamp-2 text-sm font-semibold">{s.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {s.gameLabel}
                          {s.cardCount ? ` · ${s.cardCount} cards listed so far` : ""}
                        </span>
                      </div>
                      <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-[11px]">
        Release dates come from TCGplayer&apos;s catalogue via TCG API, refreshed every 12 hours. Upcoming sets are
        announced products; their card lists fill in as cards are revealed. Click a set to see its products on
        TCGplayer.
      </p>
    </div>
  );
}
