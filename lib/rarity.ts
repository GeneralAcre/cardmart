import type { CardRarity } from "@prisma/client";

// Card rarity, ranked rarest first: the order of the filter pills (left to
// right), the listing form and the rarity meter, and the same order as the
// colour scale in RARITY_STYLE below. Shared by the listing form, the
// marketplace filter and the rarity tag on cards.

export const RARITIES: { value: CardRarity; short: string; label: string; description: string }[] = [
  { value: "SAR", short: "SAR", label: "Special Art Rare", description: "SAR / SIR: full-art scenes with the character in its world." },
  { value: "SEC", short: "SEC", label: "Secret Rare", description: "Numbered past the set total, e.g. 105/090." },
  { value: "UR", short: "UR", label: "Ultra Rare", description: "UR / HR: gold or rainbow foil." },
  { value: "AR", short: "AR", label: "Art Rare", description: "AR / IR: full-art versions of regular cards." },
  { value: "SR", short: "SR", label: "Super Rare", description: "Full-art portraits on a textured background." },
  { value: "RR", short: "RR", label: "Double Rare", description: "Core chase cards such as Pokémon ex." },
  { value: "R", short: "R", label: "Rare", description: "Regular holo or non-holo rares." },
  { value: "UC", short: "U/C", label: "Uncommon / Common", description: "The everyday cards in a pack." },
];

export const RARITY_SHORT: Record<CardRarity, string> = Object.fromEntries(RARITIES.map((r) => [r.value, r.short])) as Record<
  CardRarity,
  string
>;

// A green-to-yellow scale, one solid shade per tier so each reads apart at a
// glance: the common cards are deep green, the rarer the card the further it
// moves toward bright yellow, and SAR is the brightest of all. Two of the
// palette's ten shades are skipped (they sit too close to a neighbour to tell
// apart). Black text on every tier except the darkest green (U/C), where only
// white passes WCAG AA contrast (4.5:1) at the tags' 11px. Full
// class names so Tailwind picks them up.
export const RARITY_STYLE: Record<CardRarity, string> = {
  SAR: "bg-[#FFFF3F] text-black",
  SEC: "bg-[#EEEF20] text-black",
  UR: "bg-[#D4D700] text-black",
  AR: "bg-[#AACC00] text-black",
  SR: "bg-[#80B918] text-black",
  RR: "bg-[#55A630] text-black",
  R: "bg-[#2B9348] text-black",
  UC: "bg-[#007F5F] text-white",
};

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
