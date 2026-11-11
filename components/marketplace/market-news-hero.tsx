"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { CardGame } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/ui/game-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { useT } from "@/components/landing/language-provider";
import { useMoney } from "@/components/currency-provider";
import { OPEN_SEARCH_EVENT } from "@/components/site/header-search-button";
import { CARD_GAMES, CARD_GAME_LABELS } from "@/lib/labels";
import type { NewsCard, NewsSlide } from "@/lib/market-news";
import { cn } from "@/lib/utils";

/*
 * The banner's look: black, tall condensed uppercase type, slanted lime
 * stripes in the corners, a faint repeated word behind, and pictures tinted
 * lime (duotone) as backdrops. The front cards keep their real colours, so a
 * buyer can still see the card. Always dark (.theme-dark).
 */

// Only the eyebrow's dot says which kind of news it is; everything else is the lime.
const DOT: Record<NewsSlide["kind"], string> = {
  upcoming: "bg-compare",
  released: "bg-success",
  top: "bg-medal-gold",
  listed: "bg-white",
  auction: "bg-destructive",
};

/** Three slanted lime bars, cut off by the banner's edge. */
function Stripes({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute flex gap-2.5", className)}>
      {[1, 0.7, 0.45].map((opacity, i) => (
        <span key={i} className="bg-success block h-full w-4 -skew-x-[28deg] sm:w-6" style={{ opacity }} />
      ))}
    </div>
  );
}

/** A word repeated in rows, very faint, as a texture behind the headline. */
function WordPattern({ word }: { word: string }) {
  const line = Array.from({ length: 14 }, () => word).join(" ");
  return (
    <div
      aria-hidden
      className="font-display pointer-events-none absolute inset-0 -z-10 flex flex-col justify-center overflow-hidden text-5xl leading-[1.05] whitespace-nowrap text-white/[0.05] uppercase select-none sm:text-6xl"
    >
      {Array.from({ length: 8 }, (_, r) => (
        <span key={r} className={r % 2 ? "-translate-x-24" : "-translate-x-4"}>
          {line}
        </span>
      ))}
    </div>
  );
}

/** Text with one phrase in the lime, when the phrase is in it (it may not be, in another language). */
function Highlight({ text, phrase }: { text: string; phrase: string }) {
  const at = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-success">{text.slice(at, at + phrase.length)}</span>
      {text.slice(at + phrase.length)}
    </>
  );
}

/** A picture tinted lime: greyscale, then multiplied with the brand colour. */
function Duotone({ src, className }: { src: string; className?: string }) {
  return (
    <div aria-hidden className={cn("absolute overflow-hidden", className)}>
      <Image src={src} alt="" fill unoptimized sizes="100vw" className="animate-news-zoom object-cover contrast-125 grayscale" />
      <div className="bg-success absolute inset-0 mix-blend-multiply" />
    </div>
  );
}

/** The first slide: the Market's headline and search, over the word pattern. */
function SearchSlide({ onTyping, focusToken }: { onTyping: (typing: boolean) => void; focusToken: number }) {
  const t = useT();
  const router = useRouter();
  const [game, setGame] = useState<CardGame | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // The header's search icon bumps `focusToken`; each bump puts the cursor in the field.
  useEffect(() => {
    if (focusToken > 0) inputRef.current?.focus();
  }, [focusToken]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (game !== "ALL") params.set("game", game);
    const qs = params.toString();
    router.push(qs ? `/marketplace?${qs}#listings` : "/marketplace#listings");
  }

  return (
    <>
      <WordPattern word="CardMart" />
      <Stripes className="-top-6 right-6 h-28 sm:right-12 sm:h-36" />
      <Stripes className="-bottom-6 left-6 h-20 sm:left-12 sm:h-28" />
      <div className="flex h-full items-center px-4 sm:px-16">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 text-center sm:gap-4">
          <h2
            className="animate-news-rise font-display text-4xl leading-[0.95] tracking-wide uppercase sm:text-6xl"
            style={{ animationDelay: "0ms" }}
          >
            <Highlight text={t("Find your next card at the right price.")} phrase={t("the right price")} />
          </h2>
          <p className="animate-news-rise text-sm text-white/70 sm:text-base" style={{ animationDelay: "80ms" }}>
            {t("Compare prices across cards and grades, and follow the ones you love.")}
          </p>
          <form
            onSubmit={search}
            className="animate-news-rise grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex"
            style={{ animationDelay: "160ms" }}
          >
            <Select
              value={game}
              onValueChange={(v) => setGame(v as CardGame | "ALL")}
              onOpenChange={(open) => open && onTyping(true)}
            >
              <SelectTrigger
                className="col-span-2 !h-11 w-full border-white/20 bg-black text-white hover:bg-white/5 sm:w-40 dark:bg-black dark:hover:bg-white/5 [&_svg]:text-white/70"
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
            <div className="relative flex !h-11 min-w-0 items-center rounded-md border border-white/20 bg-black sm:flex-1">
              <Search className="pointer-events-none absolute left-3 size-4 text-white/70" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  onTyping(true);
                }}
                placeholder={t("Try Umbreon PSA 10")}
                aria-label={t("Search cards")}
                className="h-full w-full min-w-0 rounded-md bg-transparent pr-3 pl-9 text-sm text-white outline-none placeholder:text-white/50"
              />
            </div>
            <Button type="submit" className="bg-success text-success-foreground hover:bg-success/90 !h-11 px-5 font-semibold">
              {t("Search")} <ArrowRight />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

function NewsSlideView({ slide }: { slide: NewsSlide }) {
  const t = useT();
  const money = useMoney();
  const bg = slide.cards[0]?.url ?? slide.artUrl;

  return (
    <>
      {/* The slide's picture, tinted lime, across the whole banner; darkest in the
          middle behind the words. No card pictures on top: the tint is the graphic. */}
      {bg && <Duotone src={bg} className="inset-0 -z-20 opacity-75" />}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_80%_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.55)_60%,rgba(0,0,0,0.25)_100%)]"
      />
      <Stripes className="-top-6 right-6 h-24 sm:right-12 sm:h-32" />
      <Stripes className="-bottom-6 left-6 h-16 sm:left-12 sm:h-24" />

      <div className="flex h-full items-center justify-center px-5 sm:px-16">
        <div className="flex max-w-2xl min-w-0 flex-col items-center gap-2 text-center sm:gap-3">
          {/* A slanted lime tag, like the stripes. */}
          <span
            className="animate-news-rise bg-success text-success-foreground inline-flex w-fit -skew-x-[18deg] items-center px-3 py-1 text-xs font-bold tracking-wider uppercase"
            style={{ animationDelay: "0ms" }}
          >
            <span className="inline-flex skew-x-[18deg] items-center gap-2">
              <span className={cn("size-2 rounded-full ring-1 ring-black/40", DOT[slide.kind], slide.kind === "auction" && "animate-pulse")} />
              {t(slide.eyebrow, slide.eyebrowParams)}
            </span>
          </span>
          <h2
            className="animate-news-rise font-display line-clamp-2 text-3xl leading-[0.95] tracking-wide uppercase sm:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            {slide.title}
          </h2>
          <p className="animate-news-rise line-clamp-1 text-sm text-white/70" style={{ animationDelay: "160ms" }}>
            {slide.facts.map((f, i) => (
              <span key={i}>
                {i > 0 && <span className="text-success px-2">/</span>}
                {t(f.text, f.vars)}
              </span>
            ))}
          </p>
          {(slide.priceThb !== null || slide.endsAt) && (
            <div className="animate-news-rise flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1" style={{ animationDelay: "240ms" }}>
              {slide.priceThb !== null && (
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-success text-4xl tracking-wide tabular-nums sm:text-5xl">{money(slide.priceThb)}</span>
                  {slide.priceLabel && <span className="text-xs text-white/60 uppercase">{t(slide.priceLabel)}</span>}
                </span>
              )}
              {slide.endsAt && (
                <span className="text-sm text-white/70">
                  {t("Ends in")} <CountdownTimer endTime={slide.endsAt} className="font-semibold text-white tabular-nums" />
                </span>
              )}
            </div>
          )}
          <div className="animate-news-rise pt-1" style={{ animationDelay: "320ms" }}>
            <Button asChild className="bg-success text-success-foreground hover:bg-success/90 h-10 px-5 font-semibold">
              <Link href={slide.href}>
                {t(slide.cta)} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The banner at the top of the Market. It opens on the headline and search,
 * then moves through what's new: a set about to drop, the top card in each
 * index, the latest listing, a live auction. Slides move on by themselves
 * (paused while the pointer is over the banner, and for good once someone
 * starts a search), and can be changed with the arrows, the dots, or a swipe.
 * The page still passes `wall` (cards for the old moving card wall); it isn't drawn any more.
 */
export function MarketNewsHero({ slides }: { slides: NewsSlide[]; wall?: NewsCard[] }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [typing, setTyping] = useState(false);
  const touchX = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [focusToken, setFocusToken] = useState(0);

  const count = slides.length + 1; // the search slide comes first
  const go = (i: number) => setIndex((i + count) % count);
  const slide = index > 0 ? slides[index - 1] : null;
  const dot = "bg-success";

  // The header's search icon (phones) asks for the search slide: show it, stop the
  // rotation as a typed search would, scroll it into view and focus the field.
  // Arriving from another page with #search does the same once on load.
  useEffect(() => {
    const open = () => {
      setIndex(0);
      setTyping(true);
      setFocusToken((n) => n + 1);
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(OPEN_SEARCH_EVENT, open);
    if (window.location.hash === "#search") open();
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, open);
  }, []);

  return (
    <div className="mb-6 flex flex-col gap-3">
      <section
        ref={sectionRef}
        aria-roledescription="carousel"
        aria-label={t("What's new")}
        className="theme-dark group relative isolate h-72 scroll-mt-20 overflow-hidden rounded-2xl border bg-black text-white md:h-80"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div key={slide?.id ?? "search"} className="h-full">
          {slide ? <NewsSlideView slide={slide} /> : <SearchSlide onTyping={setTyping} focusToken={focusToken} />}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t("Previous")}
              className="absolute top-1/2 left-3 z-40 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-sm transition-opacity hover:bg-black/70 md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t("Next")}
              className="absolute top-1/2 right-3 z-40 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-sm transition-opacity hover:bg-black/70 md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </section>

      {/* The dots: the current one is a bar that fills while its slide shows,
          then moves on. With reduced motion it doesn't fill, so nothing moves by itself. */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={t("Slide {n} of {count}", { n: i + 1, count })}
              aria-current={i === index}
              className={cn(
                "relative h-1.5 overflow-hidden rounded-full transition-all duration-300",
                i === index ? "bg-muted-foreground/30 w-10" : "bg-muted-foreground/40 hover:bg-muted-foreground/70 w-1.5",
              )}
            >
              {i === index && (
                <span
                  key={index}
                  className={cn("animate-news-progress absolute inset-0 origin-left rounded-full", dot)}
                  style={{ animationPlayState: hovered || typing ? "paused" : "running" }}
                  onAnimationEnd={() => go(index + 1)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
