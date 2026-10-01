"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { suggestAgentCards, type CardSuggestion } from "@/lib/agent-actions";
import { formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

const GAME_LABEL = { POKEMON: "Pokémon", ONE_PIECE: "One Piece" } as const;

/** The card name box, with a dropdown of matching cards already on CardMart. */
export function CardNameInput({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (name: string) => void;
  onPick: (card: CardSuggestion) => void;
}) {
  const t = useT();
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const latest = useRef(0);

  // Debounced lookup; only the newest request's answer is shown.
  useEffect(() => {
    const q = value.trim();
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const found = await suggestAgentCards(q).catch(() => []);
      if (id !== latest.current) return;
      setSuggestions(found);
      setActive(-1);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  function pick(card: CardSuggestion) {
    onPick(card);
    setOpen(false);
  }

  const showList = open && value.trim().length >= 2 && (suggestions.length > 0 || !loading);

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls="agent-card-suggestions"
        aria-label={t("Card name")}
        autoComplete="off"
        className="h-11 pl-10 text-base"
        value={value}
        placeholder={t("Card name, e.g. Charizard ex 151 SIR")}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {loading && (
        <Loader2 className="text-muted-foreground absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin" />
      )}

      {showList && (
        <ul
          id="agent-card-suggestions"
          role="listbox"
          className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li className="text-muted-foreground px-4 py-3 text-sm">
              {t("Not on CardMart yet — the agent will still watch for it.")}
            </li>
          ) : (
            suggestions.map((card, i) => (
              <li
                key={`${card.game}:${card.name}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click, so it fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(card);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm",
                  i === active && "bg-muted",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{card.name}</span>
                  <span className="text-muted-foreground text-xs">{GAME_LABEL[card.game]}</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-right text-xs">
                  {card.forSale > 0
                    ? t("{count} for sale · from {price}", { count: card.forSale, price: formatThb(card.lowestPriceThb!) })
                    : t("None for sale now")}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
