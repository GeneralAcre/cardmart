"use client";

import { GameIcon } from "@/components/ui/game-icon";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/components/landing/language-provider";
import { CARD_GAMES, CARD_GAME_LABELS } from "@/lib/labels";
import type { CardGame } from "@prisma/client";

/**
 * The banner above the Market: a full-bleed photo (public/cover.png) behind a
 * headline and a search box. The photo is dark, so the words are white in both
 * the light and dark themes. Searching reloads the market with the words (and
 * game) already applied as filters.
 */
export function MarketHero() {
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
    <section className="relative isolate mb-6 overflow-hidden rounded-2xl border bg-black text-white">
      <Image
        src="/cover.png"
        alt=""
        fill
        priority
        sizes="(max-width: 1536px) 100vw, 1536px"
        className="-z-10 object-cover object-[50%_32%]"
      />
      {/* A dark veil, deepest behind the words, so they stay readable over the photo. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_70%_at_center,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.45)_60%,rgba(0,0,0,0.3)_100%)]"
      />

      <div className="px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl leading-tight font-bold tracking-tight [text-shadow:0_2px_20px_rgba(0,0,0,0.7)] sm:text-4xl">
            {t("Find your next card at the right price.")}
          </h2>
          <p className="text-sm text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)] sm:text-base">
            {t("Compare prices across cards and grades, and follow the ones you love.")}
          </p>
          <form onSubmit={search} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
            <Select value={game} onValueChange={(v) => setGame(v as CardGame | "ALL")}>
              <SelectTrigger
                className="col-span-2 !h-11 w-full border-white/20 bg-black/50 text-white backdrop-blur-sm hover:bg-black/60 sm:w-40 dark:bg-black/50 dark:hover:bg-black/60 [&_svg]:text-white/70"
                aria-label={t("Game")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("All games")}</SelectItem>
                {CARD_GAMES.map((g) => (
                  <SelectItem key={g} value={g}>
                    <span className="inline-flex items-center gap-2">
                      <GameIcon game={g} size={18} />
                      {t(CARD_GAME_LABELS[g])}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex !h-11 min-w-0 items-center rounded-md border border-white/20 bg-black/50 backdrop-blur-sm sm:flex-1">
              <Search className="pointer-events-none absolute left-3 size-4 text-white/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Try Umbreon PSA 10")}
                aria-label={t("Search cards")}
                className="h-full w-full min-w-0 rounded-md bg-transparent pr-3 pl-9 text-sm text-white outline-none placeholder:text-white/60"
              />
            </div>
            <Button type="submit" className="!h-11 bg-white px-5 text-black hover:bg-white/90">
              {t("Search")} <ArrowRight />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
