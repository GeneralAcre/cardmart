import type { CardGame } from "@prisma/client";

// The cards behind the Pokémon and One Piece indexes: well-known, widely
// traded cards in one grade each, priced daily from eBay (the market-prices
// cron), whether or not anyone lists them on CardMart. For One Piece that's
// the regular print, since its alt arts share the card number (see
// ONE_PIECE_VARIANT_WORDS in lib/ebay.ts). The CardMart Index is different:
// it's built from the cards actually on CardMart.
//
// Each entry has to match real eBay listings (see titleMatches in
// lib/ebay.ts): name words, the set's last part (or its code), the card
// number and the grade. Add or swap cards here; an entry that never matches
// simply never joins its index.

export interface BasketCard {
  game: CardGame;
  name: string;
  subtitle: string;
  cardNumber: string;
  language: "ENGLISH" | "JAPANESE";
  gradingCompany: "PSA" | "RAW";
  grade: number | null;
  isBlackLabel: false;
}

const psa10 = { language: "ENGLISH", gradingCompany: "PSA", grade: 10, isBlackLabel: false } as const;

export const INDEX_BASKETS: BasketCard[] = [
  // Pokémon
  { game: "POKEMON", name: "Charizard ex", subtitle: "Scarlet & Violet — Obsidian Flames", cardNumber: "223/197", ...psa10 },
  { game: "POKEMON", name: "Charizard ex", subtitle: "Scarlet & Violet — 151", cardNumber: "199/165", ...psa10 },
  { game: "POKEMON", name: "Umbreon VMAX", subtitle: "Sword & Shield — Evolving Skies", cardNumber: "215/203", ...psa10 },
  { game: "POKEMON", name: "Rayquaza VMAX", subtitle: "Sword & Shield — Evolving Skies", cardNumber: "218/203", ...psa10 },
  { game: "POKEMON", name: "Giratina V", subtitle: "Sword & Shield — Lost Origin", cardNumber: "186/196", ...psa10 },
  { game: "POKEMON", name: "Lugia V", subtitle: "Sword & Shield — Silver Tempest", cardNumber: "186/195", ...psa10 },
  { game: "POKEMON", name: "Gengar VMAX", subtitle: "Sword & Shield — Fusion Strike", cardNumber: "271/264", ...psa10 },
  { game: "POKEMON", name: "Pikachu VMAX", subtitle: "Sword & Shield — Vivid Voltage", cardNumber: "188/185", ...psa10 },
  { game: "POKEMON", name: "Iono", subtitle: "Scarlet & Violet — Paldea Evolved", cardNumber: "269/193", ...psa10 },
  { game: "POKEMON", name: "Magikarp", subtitle: "Scarlet & Violet — Paldea Evolved", cardNumber: "203/193", ...psa10 },
  { game: "POKEMON", name: "Mew ex", subtitle: "Scarlet & Violet — 151", cardNumber: "205/165", ...psa10 },
  { game: "POKEMON", name: "Pikachu with Grey Felt Hat", subtitle: "Scarlet & Violet Promos", cardNumber: "085", ...psa10 },

  // One Piece
  { game: "ONE_PIECE", name: "Monkey.D.Luffy", subtitle: "Awakening of the New Era — OP05", cardNumber: "OP05-119", ...psa10 },
  { game: "ONE_PIECE", name: "Shanks", subtitle: "Romance Dawn — OP01", cardNumber: "OP01-120", ...psa10 },
  { game: "ONE_PIECE", name: "Yamato", subtitle: "Romance Dawn — OP01", cardNumber: "OP01-121", ...psa10 },
  { game: "ONE_PIECE", name: "Roronoa Zoro", subtitle: "Romance Dawn — OP01", cardNumber: "OP01-025", ...psa10 },
  { game: "ONE_PIECE", name: "Trafalgar Law", subtitle: "Romance Dawn — OP01", cardNumber: "OP01-047", ...psa10 },
  { game: "ONE_PIECE", name: "Nami", subtitle: "Romance Dawn — OP01", cardNumber: "OP01-016", ...psa10 },
];
