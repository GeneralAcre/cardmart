"use client";

import { useRef, useState } from "react";
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
import { CARD_GAMES, CARD_GAME_LABELS } from "@/lib/labels";
import type { NewsCard, NewsSlide } from "@/lib/market-news";
import { cn } from "@/lib/utils";

/**
 * Each kind of news has its own brand colour: the label's dot, the glow behind
 * the cards, the price. Released is the lime, a live auction the red, the top
 * card gold, an upcoming set the blue, and a new listing plain white. The
 * banner is always dark (.theme-dark), so these are the dark-theme values.
 */
const ACCENT: Record<NewsSlide["kind"], { dot: string; glow: string; price: string }> = {
  upcoming: { dot: "bg-compare", glow: "var(--compare)", price: "from-compare to-white" },
  released: { dot: "bg-success", glow: "var(--success)", price: "from-success to-white" },
  top: { dot: "bg-medal-gold", glow: "var(--medal-gold)", price: "from-medal-gold to-white" },
  listed: { dot: "bg-white", glow: "#ffffff", price: "from-white/70 to-white" },
  auction: { dot: "bg-destructive", glow: "var(--destructive)", price: "from-destructive to-white" },
};

// Where the cards behind the front one sit: fanned out to either side.
const FAN = [
  { transform: "none", z: 30, opacity: 1 },
  { transform: "translateX(-52%) rotate(-11deg) scale(0.8)", z: 20, opacity: 0.7 },
  { transform: "translateX(52%) rotate(11deg) scale(0.8)", z: 10, opacity: 0.7 },
];

const SHINE =
  "animate-news-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent mix-blend-overlay";

function CardPicture({ card, front }: { card: NewsCard; front: boolean }) {
  return (
    <div className="relative aspect-[63/88] h-full overflow-hidden rounded-[5%] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/20">
      <Image src={card.url} alt={front ? card.name : ""} fill unoptimized sizes="240px" className="object-cover" />
      {front && <span aria-hidden className={SHINE} />}
    </div>
  );
}

function SlideVisual({ slide }: { slide: NewsSlide }) {
  const accent = ACCENT[slide.kind];
  // A set not out yet often has no picture at TCGplayer: its cards stand in.
  const [artFailed, setArtFailed] = useState(false);
  const art = !artFailed ? slide.artUrl : null;

  return (
    <div className="relative h-full w-full">
      {/* A soft glow in the slide's colour behind the cards. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${accent.glow} 40%, transparent), transparent)` }}
      />
      {art ? (
        // The set's own picture, at its own shape (a card, a booster, a box).
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-news-deal h-[84%]">
            <div className="animate-news-float relative h-full overflow-hidden rounded-xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/20">
              <Image
                src={art}
                alt={slide.title}
                width={400}
                height={400}
                unoptimized
                onError={() => setArtFailed(true)}
                className="h-full w-auto max-w-none"
              />
              <span aria-hidden className={SHINE} />
            </div>
          </div>
        </div>
      ) : (
        // Drawn back to front, so the first card ends up on top.
        slide.cards
          .map((card, i) => ({ card, i }))
          .reverse()
          .map(({ card, i }) => (
            <div
              key={card.url + i}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: FAN[i].transform, zIndex: FAN[i].z, opacity: FAN[i].opacity }}
            >
              <div className="animate-news-deal h-[86%]" style={{ animationDelay: `${120 + (2 - i) * 110}ms` }}>
                <div className="animate-news-float h-full" style={{ animationDelay: `${i * -2}s` }}>
                  <CardPicture card={card} front={i === 0} />
                </div>
              </div>
            </div>
          ))
      )}
    </div>
  );
}

/** Slow columns of top cards drifting up and down, tilted, behind the search slide. */
function CardWall({ cards }: { cards: NewsCard[] }) {
  if (cards.length === 0) return null;
  const columns = Array.from({ length: 7 }, (_, c) =>
    Array.from({ length: 6 }, (_, r) => cards[(c * 3 + r * 7) % cards.length]),
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      <div className="absolute -inset-x-[10%] -inset-y-1/2 grid -rotate-12 grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {columns.map((column, c) => (
          <div key={c} className={cn("min-w-0", c >= 4 && "hidden sm:block", c >= 5 && "sm:hidden lg:block")}>
            <div
              className={cn("flex flex-col gap-3", c % 2 === 0 ? "animate-wall-up" : "animate-wall-down")}
              style={{ animationDuration: `${50 + c * 6}s` }}
            >
              {[...column, ...column].map((card, i) => (
                <div key={i} className="relative aspect-[63/88] overflow-hidden rounded-lg">
                  <Image src={card.url} alt="" fill unoptimized sizes="160px" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The first slide: the Market's headline and search, over the moving card wall. */
function SearchSlide({ wall, onTyping }: { wall: NewsCard[]; onTyping: (typing: boolean) => void }) {
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
    <>
      <CardWall cards={wall} />
      {/* A dark veil, deepest behind the words, so they stay readable over the cards. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_65%_75%_at_center,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.75)_55%,rgba(0,0,0,0.5)_100%)]"
      />
      <div className="flex h-full items-center px-4 sm:px-16">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
          <h2
            className="animate-news-rise text-2xl leading-tight font-bold tracking-tight [text-shadow:0_2px_20px_rgba(0,0,0,0.7)] sm:text-4xl"
            style={{ animationDelay: "0ms" }}
          >
            {t("Find your next card at the right price.")}
          </h2>
          <p
            className="animate-news-rise text-sm text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)] sm:text-base"
            style={{ animationDelay: "80ms" }}
          >
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  onTyping(true);
                }}
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
    </>
  );
}

function NewsSlideView({ slide }: { slide: NewsSlide }) {
  const t = useT();
  const money = useMoney();
  const accent = ACCENT[slide.kind];
  const bg = slide.cards[0]?.url ?? slide.artUrl;

  return (
    <>
      {/* The slide's own picture, blurred and slowly zooming, as the backdrop. */}
      {bg && (
        <div aria-hidden className="absolute inset-0 -z-20 opacity-60">
          <Image src={bg} alt="" fill unoptimized sizes="100vw" className="animate-news-zoom object-cover blur-2xl" />
        </div>
      )}
      {/* Dark on the words' side, so they stay readable over any picture. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/80 to-black/10 md:bg-gradient-to-r md:from-black md:via-black/75 md:to-black/20"
      />

      <div className="grid h-full grid-rows-[11rem_1fr] md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="relative md:order-2">
          <SlideVisual slide={slide} />
        </div>

        <div className="flex min-w-0 flex-col justify-end gap-3 px-5 pb-6 sm:px-8 md:justify-center md:pb-0 md:pl-16">
          <span
            className="animate-news-rise inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm"
            style={{ animationDelay: "0ms" }}
          >
            <span className={cn("size-2 rounded-full", accent.dot, slide.kind === "auction" && "animate-pulse")} />
            {t(slide.eyebrow, slide.eyebrowParams)}
          </span>
          <h2
            className="animate-news-rise line-clamp-2 text-2xl leading-tight font-bold tracking-tight sm:text-4xl"
            style={{ animationDelay: "80ms" }}
          >
            {slide.title}
          </h2>
          <p className="animate-news-rise line-clamp-1 text-sm text-white/70" style={{ animationDelay: "160ms" }}>
            {slide.facts.map((f, i) => (
              <span key={i}>
                {i > 0 && <span className="px-2 text-white/30">|</span>}
                {t(f.text, f.vars)}
              </span>
            ))}
          </p>
          {(slide.priceThb !== null || slide.endsAt) && (
            <div
              className="animate-news-rise flex flex-wrap items-baseline gap-x-5 gap-y-1"
              style={{ animationDelay: "240ms" }}
            >
              {slide.priceThb !== null && (
                <span className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "bg-gradient-to-r bg-clip-text text-3xl font-extrabold text-transparent tabular-nums sm:text-4xl",
                      accent.price,
                    )}
                  >
                    {money(slide.priceThb)}
                  </span>
                  {slide.priceLabel && <span className="text-xs text-white/60">{t(slide.priceLabel)}</span>}
                </span>
              )}
              {slide.endsAt && (
                <span className="text-sm text-white/70">
                  {t("Ends in")}{" "}
                  <CountdownTimer endTime={slide.endsAt} className="font-semibold text-white tabular-nums" />
                </span>
              )}
            </div>
          )}
          <div className="animate-news-rise pt-1" style={{ animationDelay: "320ms" }}>
            <Button asChild className="h-10 bg-white px-5 font-semibold text-black hover:bg-white/90">
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
 */
export function MarketNewsHero({ slides, wall }: { slides: NewsSlide[]; wall: NewsCard[] }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [typing, setTyping] = useState(false);
  const touchX = useRef<number | null>(null);

  const count = slides.length + 1; // the search slide comes first
  const go = (i: number) => setIndex((i + count) % count);
  const slide = index > 0 ? slides[index - 1] : null;
  const dot = slide ? ACCENT[slide.kind].dot : "bg-foreground";

  return (
    <div className="mb-6 flex flex-col gap-3">
      <section
        aria-roledescription="carousel"
        aria-label={t("What's new")}
        className="theme-dark group relative isolate h-[26rem] overflow-hidden rounded-2xl border bg-black text-white md:h-80"
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
          {slide ? <NewsSlideView slide={slide} /> : <SearchSlide wall={wall} onTyping={setTyping} />}
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
