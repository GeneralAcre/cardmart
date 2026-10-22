// One-off, ADDITIVE demo-data script — fills the Market with well-known chase
// cards as MOCK listings, straight from the TCGplayer catalogue (via TCG API):
// the official image, set, card number and rarity, and a price built from the
// catalogue's real market price. Sellers are the seeded demo users and every
// cert number is made up, so none of these are real cards for sale.
//
// One search returns 50 cards, so ~100 listings cost about 10 of the 100 daily
// API requests. Never deletes anything; each card's serial comes from its
// catalogue id, so re-running skips cards already added.
//
//   npx tsx scripts/add-catalog-demo.ts [--dry-run] [--count 100]
import { PrismaClient, type CardGame, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { put } from "@vercel/blob";
import "dotenv/config";
import { normalizeRarity } from "../lib/rarity";
import { THB_PER_USD } from "../lib/pricing";
import { mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB } from "../lib/pricing";
import { getVerificationChecklist } from "../lib/verification-checklist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PLACEHOLDER_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

// Chase cards collectors look for, by game. Each search returns up to 50 printings.
const SEARCHES: { q: string; game: CardGame }[] = [
  { q: "charizard", game: "POKEMON" },
  { q: "pikachu", game: "POKEMON" },
  { q: "umbreon", game: "POKEMON" },
  { q: "mewtwo", game: "POKEMON" },
  { q: "rayquaza", game: "POKEMON" },
  { q: "lugia", game: "POKEMON" },
  { q: "gengar", game: "POKEMON" },
  { q: "mew", game: "POKEMON" },
  { q: "luffy", game: "ONE_PIECE" },
  { q: "shanks", game: "ONE_PIECE" },
  { q: "zoro", game: "ONE_PIECE" },
  { q: "nami", game: "ONE_PIECE" },
];
const GAME_SLUG: Record<CardGame, string> = { POKEMON: "pokemon", ONE_PIECE: "one-piece-card-game" };

// A graded copy sells for more than the raw market price; these are rough mock multipliers.
const GRADES: { company: GradingCompany; grade: number | null; multiplier: number }[] = [
  { company: "PSA", grade: 10, multiplier: 3 },
  { company: "PSA", grade: 9, multiplier: 1.6 },
  { company: "BGS", grade: 9.5, multiplier: 2 },
  { company: "CGC", grade: 10, multiplier: 1.8 },
  { company: "RAW", grade: null, multiplier: 1 },
];
const SELLERS = ["nattapong", "araya", "chalit"];

interface CatalogCard {
  id: number;
  name?: string;
  set_name?: string;
  number?: string;
  rarity?: string | null;
  product_type?: string;
  game_slug?: string;
  market_price?: number | null;
  image_url?: string;
}

/** "SWSH07: Evolving Skies" → "Evolving Skies"; "OP05: Awakening of the New Era" keeps its code as the set line. */
function subtitleFor(card: CatalogCard, game: CardGame): string {
  const set = (card.set_name ?? "").trim();
  if (game === "ONE_PIECE") {
    const m = set.match(/^(OP\d+|ST\d+|EB\d+|PRB\d+)\s*[:-]?\s*(.*)$/i);
    if (m) return m[2] ? `${m[2]} — ${m[1].toUpperCase()}` : m[1].toUpperCase();
  }
  return set.replace(/^[A-Z0-9]+(\s*-\s*|:\s*)/, "").trim() || set;
}

/**
 * The catalogue's name made readable: "Gengar (13)" → "Gengar", "Lugia - 29/115
 * (Pokemon Rocks America)" → "Lugia", "Mew (Prime)" → "Mew Prime".
 */
function cleanName(name: string): string {
  return name
    .replace(/\s+-\s+\d+\/\d+.*$/, "")
    .replace(/\s*\(\d+\)/g, "")
    .replace(/\s*\(([^)]+)\)/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

/** A real single card worth listing: numbered, from a proper set, not a bonus DON!! card or a promo bundle item. */
function isListable(card: CatalogCard): boolean {
  const name = card.name ?? "";
  const set = card.set_name ?? "";
  return (
    Boolean(card.number) &&
    !/^DON!!/i.test(name) &&
    !/miscellaneous|promotion cards|promo/i.test(set) &&
    cleanName(name).length <= 36
  );
}

const roundPrice =(thb: number) => (thb >= 10_000 ? Math.round(thb / 500) * 500 : Math.round(thb / 50) * 50);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

async function search(q: string): Promise<CatalogCard[]> {
  const res = await fetch(`https://api.tcgapi.dev/v1/search?q=${encodeURIComponent(q)}`, {
    headers: { "X-API-Key": process.env.TCG_API_KEY!.trim() },
  });
  if (!res.ok) throw new Error(`TCG API search "${q}" failed: HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.data) ? body.data : [];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const countArg = process.argv.indexOf("--count");
  const wanted = countArg > 0 ? Number(process.argv[countArg + 1]) : 100;

  // Collect candidates: real cards with a picture and a market price, priciest first within each search.
  const picked: { card: CatalogCard; game: CardGame }[] = [];
  const perSearch = Math.ceil(wanted / SEARCHES.length) + 2;
  for (const s of SEARCHES) {
    const results = (await search(s.q))
      .filter((c) => c.game_slug === GAME_SLUG[s.game] && c.product_type === "Cards" && c.image_url && (c.market_price ?? 0) >= 5 && isListable(c))
      .sort((a, b) => (b.market_price ?? 0) - (a.market_price ?? 0));
    for (const card of results.slice(0, perSearch)) {
      if (!picked.some((p) => p.card.id === card.id)) picked.push({ card, game: s.game });
    }
  }
  const cards = picked.slice(0, wanted);
  console.log(`${cards.length} catalogue cards picked from ${SEARCHES.length} searches.`);

  const sellers = await prisma.user.findMany({ where: { handle: { in: SELLERS } } });
  if (sellers.length === 0) throw new Error("No demo sellers found — run the seed first.");

  const placeholderPhotoUrl = dryRun
    ? ""
    : (await put("seed/placeholder.png", PLACEHOLDER_PIXEL_PNG, { access: "public", addRandomSuffix: false, allowOverwrite: true })).url;

  let added = 0;
  for (const [i, { card, game }] of cards.entries()) {
    const g = GRADES[i % GRADES.length];
    const serial = `${g.company}-TCG${card.id}`;
    if (await prisma.asset.findUnique({ where: { serial } })) {
      console.log(`skip  ${card.name} — already added`);
      continue;
    }
    const seller = sellers[i % sellers.length];
    const priceThb = Math.max(100, roundPrice((card.market_price ?? 0) * THB_PER_USD * g.multiplier));
    // An earlier price a little above or below, so the Market shows real-looking moves.
    const earlier = roundPrice(priceThb * (0.88 + ((i * 37) % 25) / 100));
    const subtitle = subtitleFor(card, game);
    const rarity = normalizeRarity(card.rarity ?? null, card.number ?? null);
    if (dryRun) {
      console.log(`would add ${cleanName(card.name ?? "")} (${subtitle} #${card.number}) — ${g.company} ${g.grade ?? ""}, ${priceThb.toLocaleString()} THB, ${rarity ?? "no rarity"}`);
      continue;
    }

    const listedAt = daysAgo(3 + (i % 20));
    const mintTx = mockTxSignature();
    const asset = await prisma.asset.create({
      data: {
        name: cleanName(card.name ?? "Card"),
        subtitle,
        category: "TRADING_CARD",
        game,
        gradingCompany: g.company,
        grade: g.grade,
        serial,
        cardNumber: card.number ?? null,
        rarity,
        catalogImageUrl: card.image_url,
        themeIndex: i % 8,
        priceThb,
        forSale: true,
        vaulted: i % 3 !== 0,
        marketStatus: i % 3 !== 0 ? "IN_VAULT" : "READY_TO_SHIP",
        pipelineStage: "NONE",
        mockMintTx: mintTx,
        verificationPackage: "SELF_MINT",
        mintFeeThb: SELF_MINT_FEE_THB,
        sellerId: seller.id,
        ownerId: seller.id,
        createdAt: listedAt,
        priceSnapshots: {
          create: [
            { priceThb: earlier, createdAt: listedAt },
            { priceThb, createdAt: daysAgo(1 + (i % 3)) },
          ],
        },
        verificationPhotos: {
          create: getVerificationChecklist("TRADING_CARD", g.company === "RAW").map((v) => ({
            viewKey: v.key,
            viewLabel: v.label,
            url: placeholderPhotoUrl,
          })),
        },
      },
    });
    await prisma.provenanceEvent.createMany({
      data: [
        {
          assetId: asset.id,
          type: "MINTED_DIGITAL_TWIN",
          note: `Demo listing: digital twin registered (${serial}).`,
          mockTxSignature: mintTx,
          actorId: seller.id,
          createdAt: listedAt,
        },
        {
          assetId: asset.id,
          type: "LISTED",
          note: `Listed for sale at ${earlier.toLocaleString()} THB.`,
          mockTxSignature: mockTxSignature(),
          actorId: seller.id,
          createdAt: listedAt,
        },
      ],
    });
    added++;
  }
  console.log(dryRun ? "Dry run: nothing written." : `Added ${added} demo listings.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
