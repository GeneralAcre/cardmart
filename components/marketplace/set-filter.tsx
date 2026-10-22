"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { CardGame } from "@prisma/client";
import { Check, Search, X } from "lucide-react";

import { GameIcon } from "@/components/ui/game-icon";
import { CARD_GAME_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

/** A set that has cards listed right now, with how many. */
export interface SetOption {
  /** The listing subtitle, which is what the filter matches on. */
  name: string;
  game: CardGame;
  count: number;
}

/** "Base Set — 1999" → { label: "Base Set", year: 1999 }; "Romance Dawn — OP01" keeps its code. */
function splitYear(name: string): { label: string; year: string | null } {
  const m = name.match(/^(.*?)\s+[—–-]\s+((?:19|20)\d\d)$/);
  return m ? { label: m[1], year: m[2] } : { label: name, year: null };
}

/** Lowercase, and with "—", "&" and punctuation flattened, so "sword shield evo" finds "Sword & Shield — Evolving Skies". */
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const GAMES: CardGame[] = ["POKEMON", "ONE_PIECE"];

/**
 * Filter by set: type to find one among hundreds, pick as many as you like.
 * Focusing opens a list grouped by game; typing narrows it. Arrow keys, Enter and Esc work like any combobox.
 */
export function SetFilter({
  options,
  selected,
  games,
  onChange,
}: {
  options: SetOption[];
  selected: string[];
  /** The games picked in the Card filter; only their sets are offered. Empty means both. */
  games: CardGame[];
  onChange: (sets: string[]) => void;
}) {
  const t = useT();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const available = useMemo(
    () => options.filter((o) => games.length === 0 || games.includes(o.game)).sort((a, b) => b.count - a.count),
    [options, games],
  );
  // Every typed word has to appear somewhere in the set's name.
  const matches = useMemo(() => {
    const words = fold(query).split(" ").filter(Boolean);
    return available.filter((o) => words.every((w) => fold(o.name).includes(w)));
  }, [available, query]);
  // Grouped by game for display; `flat` is the same order, for the arrow keys.
  const groups = GAMES.map((game) => ({ game, items: matches.filter((o) => o.game === game) })).filter((g) => g.items.length > 0);
  const flat = groups.flatMap((g) => g.items);

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (flat.length === 0 ? 0 : (i + step + flat.length) % flat.length));
    } else if (e.key === "Enter" && open && flat[active]) {
      e.preventDefault();
      toggle(flat[active].name);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <label className="text-foreground border-foreground/25 focus-within:border-foreground/50 hover:border-foreground/50 flex h-10 items-center gap-2 rounded-full border px-3.5 transition-colors md:h-8">
          <Search className="size-3.5 shrink-0" />
          <input
            ref={inputRef}
            id="set-filter"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder={t("Search sets…")}
            className="placeholder:text-foreground min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label={t("Clear")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery("")}
              className="hover:text-foreground/70"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>

        {/* Suggestions, grouped by game. mousedown is held so a click doesn't blur the box first. */}
        {open && (
          <div
            id={listId}
            role="listbox"
            aria-multiselectable
            className="bg-popover absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border p-1 shadow-lg"
          >
            {flat.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {available.length === 0 ? t("No sets listed yet.") : t("No sets match “{q}”.", { q: query })}
              </p>
            ) : (
              groups.map(({ game, items }) => (
                <div key={game} className="flex flex-col">
                  <span className="text-muted-foreground flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                    <GameIcon game={game} size={12} />
                    {t(CARD_GAME_LABELS[game])}
                  </span>
                  {items.map((o) => {
                    const index = flat.indexOf(o);
                    const isSelected = selected.includes(o.name);
                    const { label, year } = splitYear(o.name);
                    return (
                      <div
                        key={o.name}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => toggle(o.name)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
                          index === active && "bg-secondary",
                        )}
                      >
                        <span className={cn("flex size-4 shrink-0 items-center justify-center", !isSelected && "invisible")}>
                          <Check className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {year && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{year}</span>}
                        <span
                          className="bg-secondary text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                          title={t("{count} listed", { count: o.count })}
                        >
                          {o.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Picked sets, each removable. */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              aria-label={t("Remove {set}", { set: name })}
              className="bg-primary text-primary-foreground flex h-7 max-w-full items-center gap-1 rounded-full pr-2 pl-3 text-xs font-semibold"
            >
              <span className="truncate">{splitYear(name).label}</span>
              <X className="size-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
