// One-off, ADDITIVE demo-data script — adds real, cheaper slabs (about
// 2,000–3,000 THB) so the market isn't only six-figure cards. For each card it
// checks eBay in a few grades and lists it in the grade whose eBay median
// really lands in that band, priced near it, so deal badges and the grade
// comparison show true numbers. Card numbers are set here, not guessed, and
// the catalogue image is only used when its number matches. Never deletes
// anything and skips a card a seller already lists, so it's safe to re-run.
//
//   npx tsx scripts/add-budget-demo.ts --dry-run   (prints the plan only)
//   npx tsx scripts/add-budget-demo.ts
//
// lib/ebay.ts imports "server-only", which only resolves inside Next; outside
// it, point NODE_PATH at a folder with an empty server-only module.
import { PrismaClient, type CardGame, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { put } from "@vercel/blob";
import "dotenv/config";
import { mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB, THB_PER_USD } from "../lib/pricing";
import { getVerificationChecklist } from "../lib/verification-checklist";
import { lookupEbayPrice } from "../lib/ebay";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const DRY_RUN = process.argv.includes("--dry-run");

const PLACEHOLDER_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

// The band we want, and how far outside it an eBay median may sit before a
// grade is ruled out (the listing price itself is always clamped into it).
const MIN_THB = 2000;
const MAX_THB = 3000;
const ACCEPT_LOW = 1600;
const ACCEPT_HIGH = 3600;

const GRADES: { gradingCompany: GradingCompany; grade: number }[] = [
  { gradingCompany: "PSA", grade: 9 },
  { gradingCompany: "PSA", grade: 10 },
  { gradingCompany: "CGC", grade: 10 },
  { gradingCompany: "CGC", grade: 9.5 },
];

interface DemoCard {
  name: string;
  subtitle: string;
  cardNumber: string;
  game: CardGame;
  sellers: string[]; // one listing per seller handle
}

const CARDS: DemoCard[] = [
  { name: "Iono", subtitle: "Scarlet & Violet — Paldea Evolved", cardNumber: "269/193", game: "POKEMON", sellers: ["nattapong", "chalit"] },
  { name: "Erika's Invitation", subtitle: "Scarlet & Violet — 151", cardNumber: "203/165", game: "POKEMON", sellers: ["araya"] },
  { name: "Bulbasaur", subtitle: "Scarlet & Violet — 151", cardNumber: "166/165", game: "POKEMON", sellers: ["chalit"] },
  { name: "Charmander", subtitle: "Scarlet & Violet — 151", cardNumber: "168/165", game: "POKEMON", sellers: ["nattapong", "araya"] },
  { name: "Squirtle", subtitle: "Scarlet & Violet — 151", cardNumber: "170/165", game: "POKEMON", sellers: ["araya"] },
  { name: "Pikachu", subtitle: "Scarlet & Violet — 151", cardNumber: "173/165", game: "POKEMON", sellers: ["chalit"] },
  { name: "Psyduck", subtitle: "Scarlet & Violet — 151", cardNumber: "175/165", game: "POKEMON", sellers: ["nattapong"] },
  { name: "Dragonair", subtitle: "Scarlet & Violet — 151", cardNumber: "181/165", game: "POKEMON", sellers: ["araya"] },
  { name: "Pikachu", subtitle: "Sword & Shield — Crown Zenith", cardNumber: "GG30/GG70", game: "POKEMON", sellers: ["chalit"] },
];

const GAME_SLUGS: Record<CardGame, string> = { POKEMON: "pokemon", ONE_PIECE: "one-piece-card-game" };
const normNumber = (n: string) => n.toUpperCase().replace(/\s+/g, "");

/**
 * The catalogue image for exactly this printing, or null: the result has to
 * carry this card number, and when several do (English and Japanese 151),
 * the one whose set name matches the subtitle's set wins. Searches by the
 * catalogue's own "Name - 166/165" naming first, since a bare name only
 * returns its first 50 printings.
 */
async function catalogImage(card: DemoCard): Promise<string | null> {
  const key = process.env.TCG_API_KEY?.trim();
  if (!key) return null;
  const base = card.name.replace(/\balternate art\b/i, "").trim();
  const want = normNumber(card.cardNumber);
  const set = card.subtitle.split(/[—–]/).at(-1)!.trim().toLowerCase();
  for (const query of [`${base} - ${card.cardNumber}`, base]) {
    const res = await fetch(`https://api.tcgapi.dev/v1/search?q=${encodeURIComponent(query)}`, { headers: { "X-API-Key": key } });
    if (!res.ok) continue;
    const results: { game_slug?: string; image_url?: string; number?: string; name?: string; set_name?: string }[] = (await res.json())?.data ?? [];
    const matches = results.filter((r) => r.game_slug === GAME_SLUGS[card.game] && r.image_url && r.number && normNumber(r.number) === want);
    if (matches.length === 0) continue;
    // One Piece alternate arts share the base card's number; prefer the "(Alternate Art)" entry.
    const alt = /alternate art/i.test(card.name) ? matches.find((r) => /alternate art/i.test(r.name ?? "")) : undefined;
    const sameSet = matches.find((r) => (r.set_name ?? "").replace(/^[^:]*:\s*/, "").toLowerCase().includes(set));
    return (alt ?? sameSet ?? matches[0]).image_url ?? null;
  }
  return null;
}

const round100 = (n: number) => Math.round(n / 100) * 100;
const clamp = (n: number) => Math.min(MAX_THB, Math.max(MIN_THB, n));
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

async function main() {
  const placeholderPhotoUrl = DRY_RUN
    ? ""
    : (await put("seed/placeholder.png", PLACEHOLDER_PIXEL_PNG, { access: "public", addRandomSuffix: false, allowOverwrite: true })).url;

  let serialSeq = 0;
  for (const card of CARDS) {
    // First grade whose real eBay median sits in the band.
    let chosen: { gradingCompany: GradingCompany; grade: number; medianThb: number; count: number } | null = null;
    for (const g of GRADES) {
      const quote = await lookupEbayPrice({ name: card.name, subtitle: card.subtitle, cardNumber: card.cardNumber, isBlackLabel: false, ...g });
      const medianThb = quote ? Math.round(quote.medianPriceUsd * THB_PER_USD) : null;
      console.log(`  eBay ${card.name} ${card.cardNumber} ${g.gradingCompany} ${g.grade}: ${quote ? `${quote.itemCount} listings, median ${medianThb} THB` : "no match"}`);
      if (medianThb != null && quote!.itemCount >= 2 && medianThb >= ACCEPT_LOW && medianThb <= ACCEPT_HIGH) {
        chosen = { ...g, medianThb, count: quote!.itemCount };
        break;
      }
    }
    if (!chosen) {
      console.log(`skip  ${card.name} (${card.subtitle}) — no grade with an eBay median near ${MIN_THB}–${MAX_THB} THB`);
      continue;
    }
    const imageUrl = await catalogImage(card);

    for (const [i, handle] of card.sellers.entries()) {
      const seller = await prisma.user.findUnique({ where: { handle } });
      if (!seller) {
        console.log(`skip  ${card.name} — demo seller @${handle} not found`);
        continue;
      }
      const exists = await prisma.asset.findFirst({
        where: { name: card.name, subtitle: card.subtitle, sellerId: seller.id, gradingCompany: chosen.gradingCompany, grade: chosen.grade },
      });
      if (exists) {
        console.log(`skip  ${card.name} ${chosen.gradingCompany} ${chosen.grade} — @${handle} already lists it`);
        continue;
      }

      // A second copy is priced a little higher, so Best Deals has something to rank.
      const priceThb = clamp(round100(chosen.medianThb * (i === 0 ? 0.92 : 1.02)));
      // Asking price drifted down to today's, like a seller chasing the market.
      const history: [number, number][] = [
        [14 - i * 3, clamp(round100(priceThb * 1.12))],
        [6 - i, clamp(round100(priceThb * 1.05))],
        [1, priceThb],
      ].filter((p, idx, all) => idx === 0 || p[1] !== all[idx - 1][1]) as [number, number][];
      const serial = `${chosen.gradingCompany}-${(70100000 + Date.now() % 100000 * 10 + serialSeq++).toString()}`;

      console.log(
        `${DRY_RUN ? "plan " : "add  "} ${card.name} ${card.cardNumber} ${chosen.gradingCompany} ${chosen.grade} @${handle}: ` +
          `${history.map(([, p]) => p.toLocaleString()).join(" → ")} THB (eBay median ${chosen.medianThb.toLocaleString()}, ${chosen.count} listings)` +
          `${imageUrl ? "" : " — no catalogue image"}`,
      );
      if (DRY_RUN) continue;

      const listedAt = daysAgo(history[0][0]);
      const mintTx = mockTxSignature();
      const asset = await prisma.asset.create({
        data: {
          name: card.name,
          subtitle: card.subtitle,
          cardNumber: card.cardNumber,
          catalogImageUrl: imageUrl,
          category: "TRADING_CARD",
          game: card.game,
          gradingCompany: chosen.gradingCompany,
          grade: chosen.grade,
          serial,
          themeIndex: serialSeq % 8,
          priceThb,
          forSale: true,
          vaulted: i % 2 === 0,
          marketStatus: i % 2 === 0 ? "IN_VAULT" : "READY_TO_SHIP",
          pipelineStage: "NONE",
          mockMintTx: mintTx,
          verificationPackage: "SELF_MINT",
          mintFeeThb: SELF_MINT_FEE_THB,
          sellerId: seller.id,
          ownerId: seller.id,
          createdAt: listedAt,
          priceSnapshots: { create: history.map(([days, price]) => ({ priceThb: price, createdAt: daysAgo(days) })) },
          verificationPhotos: {
            create: getVerificationChecklist("TRADING_CARD", false).map((v) => ({ viewKey: v.key, viewLabel: v.label, url: placeholderPhotoUrl })),
          },
        },
      });
      await prisma.provenanceEvent.createMany({
        data: [
          {
            assetId: asset.id,
            type: "MINTED_DIGITAL_TWIN",
            note: `Self-Mint package: digital twin registered from ${chosen.gradingCompany} certificate ${serial} (${SELF_MINT_FEE_THB} THB fee).`,
            mockTxSignature: mintTx,
            actorId: seller.id,
            createdAt: listedAt,
          },
          ...history.map(([days, price], idx) => ({
            assetId: asset.id,
            type: "LISTED" as const,
            note: idx === 0 ? `Listed for sale at ${price.toLocaleString()} THB.` : `Price updated to ${price.toLocaleString()} THB.`,
            mockTxSignature: mockTxSignature(),
            actorId: seller.id,
            createdAt: daysAgo(days),
          })),
        ],
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
