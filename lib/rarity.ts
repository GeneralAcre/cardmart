import type { CardRarity } from "@prisma/client";

// Card rarity, grouped the way collectors talk about it: the chase rares
// first, then the base and gameplay rares. Shared by the listing form, the
// marketplace filter and the rarity tag on cards.

export const RARITIES: { value: CardRarity; short: string; label: string; description: string }[] = [
  { value: "SAR", short: "SAR", label: "Special Art Rare", description: "SAR / SIR: full-art scenes with the character in its world." },
  { value: "AR", short: "AR", label: "Art Rare", description: "AR / IR: full-art versions of regular cards." },
  { value: "SR", short: "SR", label: "Super Rare", description: "Full-art portraits on a textured background." },
  { value: "UR", short: "UR", label: "Ultra Rare", description: "UR / HR: gold or rainbow foil." },
  { value: "SEC", short: "SEC", label: "Secret Rare", description: "Numbered past the set total, e.g. 105/090." },
  { value: "RR", short: "RR", label: "Double Rare", description: "Core chase cards such as Pokémon ex." },
  { value: "R", short: "R", label: "Rare", description: "Regular holo or non-holo rares." },
  { value: "UC", short: "U/C", label: "Uncommon / Common", description: "The everyday cards in a pack." },
];

export const RARITY_SHORT: Record<CardRarity, string> = Object.fromEntries(RARITIES.map((r) => [r.value, r.short])) as Record<
  CardRarity,
  string
>;

export const isRarity = (value: string | null | undefined): value is CardRarity =>
  RARITIES.some((r) => r.value === value);

// Catalog wording (TCGplayer data via TCG API) → our groups. Pokémon spells
// rarities out; One Piece uses short codes. Matched on the lowercased text.
const CATALOG_MAP: [RegExp, CardRarity][] = [
  [/^(special (illustration|art) rare|sar|sir)$/, "SAR"],
  [/^(illustration rare|art rare|ar|ir)$/, "AR"],
  [/^(hyper rare|ur|hr|rainbow rare|gold rare)$/, "UR"],
  [/^(secret rare|sec|scr)$/, "SEC"],
  // English Pokémon "Ultra Rare" is the full-art tier (V, ex full arts) — SR.
  [/^(ultra rare|super rare|sr)$/, "SR"],
  [/^(double rare|rr)$/, "RR"],
  [/^(rare|rare holo|holo rare|rare holo v|rare holo vmax|r)$/, "R"],
  [/^(uncommon|common|uc|c|u)$/, "UC"],
];

/** "215/203" → the printed number is past the set total. */
function pastSetTotal(cardNumber: string | null | undefined): boolean {
  const m = cardNumber?.match(/^\s*0*(\d+)\s*\/\s*0*(\d+)\s*$/);
  return Boolean(m && Number(m[1]) > Number(m[2]));
}

/**
 * Our rarity group for a card: the catalog's rarity when it maps to one,
 * otherwise Secret Rare when the printed number is past the set total, else
 * null (unknown — the seller can set it).
 */
export function normalizeRarity(catalogRarity: string | null | undefined, cardNumber?: string | null): CardRarity | null {
  const text = catalogRarity?.trim().toLowerCase();
  if (text) {
    for (const [pattern, rarity] of CATALOG_MAP) if (pattern.test(text)) return rarity;
  }
  return pastSetTotal(cardNumber) ? "SEC" : null;
}
