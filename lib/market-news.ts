import "server-only";

import type { CardGame } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { WAREHOUSE_FIRST, displayImage } from "@/lib/card-image";
import { CARD_GAME_LABELS } from "@/lib/labels";
import { THB_PER_USD } from "@/lib/pricing";
import { getSetReleases } from "@/lib/tcg-releases";

// The slides of the banner at the top of the Market: what's new right now.
// Each one is built from live data (the set-release feed, the daily top-card
// indexes, the newest listings, the live auctions) and is simply left out
// when its data isn't there, so the banner never shows an empty slide.

export interface NewsCard {
  url: string;
  name: string;
}

export interface NewsSlide {
  id: string;
  kind: "upcoming" | "released" | "top" | "listed" | "auction";
  /** The small label above the title, in English (translated on the client). */
  eyebrow: string;
  /** Values for the eyebrow's {placeholders}. */
  eyebrowParams?: Record<string, string>;
  title: string;
  /** The facts under the title: a game, a set, a date, a count. English, with {placeholders}. */
  facts: { text: string; vars?: Record<string, string | number> }[];
  /** A price shown big beside the title, in baht. */
  priceThb: number | null;
  /** What the price is: "Market price", "Current bid"… */
  priceLabel: string | null;
  href: string;
  cta: string;
  /** The pictures on the right, the first one in front. Up to three. */
  cards: NewsCard[];
  /** A set's own artwork, shown in place of cards when there are none. */
  artUrl: string | null;
  /** For a live auction: when it ends, for the countdown. */
  endsAt: string | null;
}

const GAMES: { game: CardGame; slug: string; index: string }[] = [
  { game: "POKEMON", slug: "pokemon", index: "Pokémon Index" },
  { game: "ONE_PIECE", slug: "one-piece", index: "One Piece Index" },
];

const RELEASE_GAME: Record<string, CardGame> = { pokemon: "POKEMON", "one-piece-card-game": "ONE_PIECE" };

/** The most valuable cards in a game's index today, best first. */
async function topCards(game: CardGame, take: number) {
  const latest = await prisma.indexPrice.findFirst({ where: { game }, orderBy: { day: "desc" }, select: { day: true } });
  if (!latest) return [];
  return prisma.indexPrice.findMany({
    where: { game, day: latest.day, imageUrl: { not: null } },
    orderBy: { rank: "asc" },
    take,
  });
}

const fmtDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export interface MarketNews {
  slides: NewsSlide[];
  /** Pictures for the moving wall behind the search slide: the top cards of both indexes, mixed. */
  wall: NewsCard[];
}

export async function getMarketNews(): Promise<MarketNews> {
  const [releases, tops, listed, auction] = await Promise.all([
    getSetReleases(60).catch(() => null),
    Promise.all(GAMES.map((g) => topCards(g.game, 12).catch(() => []))),
    prisma.asset
      .findMany({
        where: { forSale: true, priceThb: { not: null }, marketStatus: { notIn: ["IN_ESCROW", "IN_AUCTION"] } },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          subtitle: true,
          priceThb: true,
          createdAt: true,
          catalogImageUrl: true,
          verificationPhotos: { orderBy: WAREHOUSE_FIRST, select: { url: true } },
        },
      })
      .catch(() => []),
    prisma.auction
      .findFirst({
        where: { status: "ACTIVE", startTime: { lte: new Date() }, endTime: { gt: new Date() } },
        orderBy: { endTime: "asc" },
        select: {
          id: true,
          endTime: true,
          startPriceThb: true,
          currentBidThb: true,
          _count: { select: { bids: true } },
          asset: {
            select: {
              id: true,
              name: true,
              subtitle: true,
              catalogImageUrl: true,
              verificationPhotos: { orderBy: WAREHOUSE_FIRST, select: { url: true } },
            },
          },
        },
      })
      .catch(() => null),
  ]);

  const slides: NewsSlide[] = [];
  const topOf = (game: CardGame) => tops[GAMES.findIndex((g) => g.game === game)] ?? [];
  const asCards = (rows: { imageUrl: string | null; name: string }[]) =>
    rows
      .filter((r) => r.imageUrl)
      .slice(0, 3)
      .map((r) => ({ url: r.imageUrl!, name: r.name }));

  // A new set: the next one coming out, then the latest one already out.
  const setSlide = (set: NonNullable<typeof releases>["upcoming"][number], kind: "upcoming" | "released"): NewsSlide => {
    const game = RELEASE_GAME[set.game];
    return {
      id: `set-${set.id}`,
      kind,
      eyebrow: kind === "upcoming" ? "New set drop" : "Out now",
      title: set.name,
      facts: [
        { text: set.gameLabel },
        { text: kind === "upcoming" ? "Releases {date}" : "Released {date}", vars: { date: fmtDate(set.releaseDate) } },
        ...(set.cardCount ? [{ text: "{count} cards", vars: { count: set.cardCount } }] : []),
      ],
      priceThb: null,
      priceLabel: null,
      href: "/news",
      cta: "See the release calendar",
      // The set's own art is shown when it has some and it loads; the game's
      // chase cards stand in otherwise (a set not out yet often has no picture).
      cards: game ? asCards(topOf(game)) : [],
      artUrl: set.imageUrl,
      endsAt: null,
    };
  };
  if (releases?.upcoming[0]) slides.push(setSlide(releases.upcoming[0], "upcoming"));
  if (releases?.recent[0]) slides.push(setSlide(releases.recent[0], "released"));

  // The most valuable card in each game today.
  GAMES.forEach(({ game, slug, index }, i) => {
    const [first] = tops[i];
    if (!first) return;
    slides.push({
      id: `top-${game}`,
      kind: "top",
      eyebrow: "#1 in the {index}",
      eyebrowParams: { index },
      title: first.name,
      facts: [{ text: CARD_GAME_LABELS[game] }, { text: first.setName }, ...(first.rarity ? [{ text: first.rarity }] : [])],
      priceThb: Math.round(first.priceUsd * THB_PER_USD),
      priceLabel: "Market price",
      href: `/market/index/${slug}`,
      cta: "See the top 50",
      cards: asCards(tops[i]),
      artUrl: null,
      endsAt: null,
    });
  });

  // The newest listings that have a picture.
  const withPics = listed
    .map((a) => ({ ...a, url: displayImage(a)?.url }))
    .filter((a): a is typeof a & { url: string } => Boolean(a.url))
    .slice(0, 3);
  if (withPics.length > 0) {
    const [first] = withPics;
    const weekAgo = Date.now() - 7 * 86_400_000;
    const thisWeek = listed.filter((a) => a.createdAt.getTime() >= weekAgo).length;
    slides.push({
      id: "listed",
      kind: "listed",
      eyebrow: "Just listed",
      title: first.name,
      facts: [
        { text: first.subtitle },
        ...(thisWeek > 1 ? [{ text: "{count} new listings this week", vars: { count: thisWeek } }] : []),
      ],
      priceThb: first.priceThb,
      priceLabel: "Price",
      href: `/item/${first.id}`,
      cta: "View the card",
      cards: withPics.map((a) => ({ url: a.url, name: a.name })),
      artUrl: null,
      endsAt: null,
    });
  }

  // The live auction ending soonest.
  const auctionPic = auction ? displayImage(auction.asset)?.url : undefined;
  if (auction && auctionPic) {
    const bids = auction._count.bids;
    slides.push({
      id: `auction-${auction.id}`,
      kind: "auction",
      eyebrow: "Live auction",
      title: auction.asset.name,
      facts: [{ text: auction.asset.subtitle }, { text: bids === 1 ? "1 bid" : "{count} bids", vars: { count: bids } }],
      priceThb: auction.currentBidThb ?? auction.startPriceThb,
      priceLabel: auction.currentBidThb ? "Current bid" : "Starting bid",
      href: `/item/${auction.asset.id}`,
      cta: "Place a bid",
      cards: [{ url: auctionPic, name: auction.asset.name }],
      artUrl: null,
      endsAt: auction.endTime.toISOString(),
    });
  }

  // Pokémon and One Piece cards taking turns, so neither game fills a column.
  const wall: NewsCard[] = [];
  for (let i = 0; i < Math.max(...tops.map((t) => t.length), 0); i++) {
    for (const rows of tops) {
      const r = rows[i];
      if (r?.imageUrl) wall.push({ url: r.imageUrl, name: r.name });
    }
  }

  return { slides, wall };
}
