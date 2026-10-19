"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/components/landing/language-provider";
import { CARD_GAMES, CARD_GAME_LABELS } from "@/lib/labels";
import type { CardGame } from "@prisma/client";

/**
 * The banner above the Market: a pile of live listings spread behind a headline
 * and a search box. The words sit straight on the background (a soft dark glow behind them, no box) so they stay
 * easy to read while the cards stay visible around it. Searching reloads the
 * market with the words (and game) already applied as filters. `cards` is the
 * CardScatter, passed in because it is a server component.
 */
export function MarketHero({ cards }: { cards: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [game, setGame] = useState<CardGame | "ALL">("ALL");
  const [query, setQuery] = useState("");

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (game !== "ALL") params.set("game", game);
    const qs = params.toString();
    router.push(qs ? `/marketplace?${qs}#listings` : "/marketplace#listings");
  }

  return (
    <section className="bg-card relative isolate mb-6 overflow-hidden rounded-2xl border">
      {/* The pile of cards at full strength behind everything. */}
      <div className="absolute inset-0 -z-10">{cards}</div>
      {/* Edges fade into the dark; a soft dark glow sits behind the words (no box, no edge) so they blend into the cards. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_center,color-mix(in_oklab,var(--background)_82%,transparent)_0%,color-mix(in_oklab,var(--background)_55%,transparent)_55%,transparent_100%),radial-gradient(ellipse_at_center,transparent_55%,color-mix(in_oklab,var(--background)_85%,transparent)_100%)]"
      />

      <div className="px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl leading-tight font-bold tracking-tight [text-shadow:0_2px_20px_rgba(0,0,0,0.7)] sm:text-4xl">{t("Find your next card at the right price.")}</h2>
          <p className="text-foreground/80 text-sm [text-shadow:0_1px_12px_rgba(0,0,0,0.7)] sm:text-base">
            {t("Compare prices across cards and grades, and follow the ones you love.")}
          </p>
          <form onSubmit={search} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
            <Select value={game} onValueChange={(v) => setGame(v as CardGame | "ALL")}>
              <SelectTrigger className="bg-background col-span-2 !h-12 w-full sm:w-40" aria-label={t("Game")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("All games")}</SelectItem>
                {CARD_GAMES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {t(CARD_GAME_LABELS[g])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="bg-background border-input relative flex h-12 min-w-0 items-center rounded-md border sm:flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 size-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Try Umbreon PSA 10")}
                aria-label={t("Search cards")}
                className="placeholder:text-muted-foreground h-full w-full min-w-0 rounded-md bg-transparent pr-3 pl-9 text-sm outline-none"
              />
            </div>
            <Button type="submit" className="h-12 px-5">
              {t("Search")} <ArrowRight />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
