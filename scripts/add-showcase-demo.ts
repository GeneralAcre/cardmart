// One-off, ADDITIVE demo-data script — adds well-known chase cards (the kind
// a grading company shows off) as MOCK listings, so the Market has something
// worth looking at. These are not real cards for sale: the sellers are the
// seeded demo users, the cert numbers are made up, and the picture is the
// official catalogue image (lib/card-catalog.ts), shown in a drawn slab.
//
// Never deletes anything. Skips a card whose serial already exists, and skips
// any card the catalogue has no confident picture for (no blank tiles).
// Uses one TCG API request per card, out of the 100 a day.
//
//   npx tsx scripts/add-showcase-demo.ts [--dry-run]
import { PrismaClient, type CardGame, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { put } from "@vercel/blob";
import "dotenv/config";
import { findCatalogCard } from "../lib/card-catalog";
import { normalizeRarity } from "../lib/rarity";
import { mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB } from "../lib/pricing";
import { getVerificationChecklist } from "../lib/verification-checklist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Same stand-in capture as prisma/seed.ts — never shown (lib/card-image.ts).
const PLACEHOLDER_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

interface ShowcaseCard {
  name: string;
  subtitle: string;
  game: CardGame;
  gradingCompany: GradingCompany;
  grade: number;
  /** Made-up cert number; "SHOW" marks it as demo data. */
  serial: string;
  sellerHandle: string;
  vaulted: boolean;
  /** [daysAgo, priceThb], oldest first; the last is the listed price. Mock prices. */
  priceHistory: [number, number][];
}

const CARDS: ShowcaseCard[] = [
  {
    name: "Charizard Holo 1st Edition",
    subtitle: "Base Set — 1999",
    game: "POKEMON",
    gradingCompany: "PSA",
    grade: 9,
    serial: "PSA-SHOW000001",
    sellerHandle: "chalit",
    vaulted: true,
    priceHistory: [[30, 1_850_000], [6, 1_920_000]],
  },
  {
    name: "Mewtwo Holo 1st Edition",
    subtitle: "Base Set — 1999",
    game: "POKEMON",
    gradingCompany: "PSA",
    grade: 9,
    serial: "PSA-SHOW000002",
    sellerHandle: "nattapong",
    vaulted: true,
    priceHistory: [[21, 92_000], [4, 88_000]],
  },
  {
    name: "Rayquaza VMAX Alternate Art",
    subtitle: "Sword & Shield — Evolving Skies",
    game: "POKEMON",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-SHOW000003",
    sellerHandle: "araya",
    vaulted: true,
    priceHistory: [[18, 26_000], [3, 28_500]],
  },
  {
    name: "Giratina V Alternate Art",
    subtitle: "Sword & Shield — Lost Origin",
    game: "POKEMON",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-SHOW000004",
    sellerHandle: "chalit",
    vaulted: false,
    priceHistory: [[14, 41_000], [2, 44_500]],
  },
  {
    name: "Lugia V Alternate Art",
    subtitle: "Sword & Shield — Silver Tempest",
    game: "POKEMON",
    gradingCompany: "BGS",
    grade: 9.5,
    serial: "BGS-SHOW000005",
    sellerHandle: "nattapong",
    vaulted: true,
    priceHistory: [[16, 21_500], [5, 20_200]],
  },
  {
    name: "Gengar & Mimikyu GX Alternate Art",
    subtitle: "Sun & Moon — Team Up",
    game: "POKEMON",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-SHOW000006",
    sellerHandle: "araya",
    vaulted: true,
    priceHistory: [[25, 58_000], [7, 61_000]],
  },
  {
    name: "Charizard ex Special Illustration Rare",
    subtitle: "Scarlet & Violet — 151",
    game: "POKEMON",
    gradingCompany: "CGC",
    grade: 10,
    serial: "CGC-SHOW000007",
    sellerHandle: "chalit",
    vaulted: false,
    priceHistory: [[12, 17_500], [1, 18_900]],
  },
  {
    name: "Portgas.D.Ace Alternate Art",
    subtitle: "Paramount War — OP02",
    game: "ONE_PIECE",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-SHOW000008",
    sellerHandle: "nattapong",
    vaulted: true,
    priceHistory: [[20, 14_200], [3, 13_400]],
  },
  {
    name: "Nami Alternate Art",
    subtitle: "Romance Dawn — OP01",
    game: "ONE_PIECE",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-SHOW000009",
    sellerHandle: "araya",
    vaulted: true,
    priceHistory: [[10, 8_600], [2, 9_200]],
  },
  {
    name: "Trafalgar Law Alternate Art",
    subtitle: "Romance Dawn — OP01",
    game: "ONE_PIECE",
    gradingCompany: "BGS",
    grade: 9.5,
    serial: "BGS-SHOW000010",
    sellerHandle: "chalit",
    vaulted: false,
    priceHistory: [[9, 7_400]],
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const placeholderPhotoUrl = dryRun
    ? ""
    : (
        await put("seed/placeholder.png", PLACEHOLDER_PIXEL_PNG, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
        })
      ).url;

  for (const card of CARDS) {
    if (await prisma.asset.findUnique({ where: { serial: card.serial } })) {
      console.log(`skip  ${card.name} — ${card.serial} already exists`);
      continue;
    }
    const seller = await prisma.user.findUnique({ where: { handle: card.sellerHandle } });
    if (!seller) {
      console.log(`skip  ${card.name} — demo seller @${card.sellerHandle} not found`);
      continue;
    }
    const catalog = await findCatalogCard({ name: card.name, subtitle: card.subtitle, game: card.game });
    if (!catalog) {
      console.log(`skip  ${card.name} — no confident catalogue picture`);
      continue;
    }
    const rarity = normalizeRarity(catalog.rarity, catalog.number);
    if (dryRun) {
      console.log(`would add ${card.name} — #${catalog.number ?? "?"}, ${rarity ?? "no rarity"}, ${catalog.imageUrl}`);
      continue;
    }

    const listedAt = daysAgo(card.priceHistory[0][0]);
    const priceThb = card.priceHistory[card.priceHistory.length - 1][1];
    const mintTx = mockTxSignature();
    const asset = await prisma.asset.create({
      data: {
        name: card.name,
        subtitle: card.subtitle,
        category: "TRADING_CARD",
        game: card.game,
        gradingCompany: card.gradingCompany,
        grade: card.grade,
        serial: card.serial,
        cardNumber: catalog.number,
        rarity,
        catalogImageUrl: catalog.imageUrl,
        themeIndex: 0,
        priceThb,
        forSale: true,
        vaulted: card.vaulted,
        marketStatus: card.vaulted ? "IN_VAULT" : "READY_TO_SHIP",
        pipelineStage: "NONE",
        mockMintTx: mintTx,
        verificationPackage: "SELF_MINT",
        mintFeeThb: SELF_MINT_FEE_THB,
        sellerId: seller.id,
        ownerId: seller.id,
        createdAt: listedAt,
        priceSnapshots: {
          create: card.priceHistory.map(([days, price]) => ({ priceThb: price, createdAt: daysAgo(days) })),
        },
        verificationPhotos: {
          create: getVerificationChecklist("TRADING_CARD", false).map((v) => ({
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
          note: `Demo listing: digital twin registered from ${card.gradingCompany} certificate ${card.serial}.`,
          mockTxSignature: mintTx,
          actorId: seller.id,
          createdAt: listedAt,
        },
        {
          assetId: asset.id,
          type: "LISTED",
          note: `Listed for sale at ${card.priceHistory[0][1].toLocaleString()} THB.`,
          mockTxSignature: mockTxSignature(),
          actorId: seller.id,
          createdAt: listedAt,
        },
      ],
    });
    console.log(`added ${card.name} (${card.serial}) — ${priceThb.toLocaleString()} THB, ${rarity ?? "no rarity"}, @${card.sellerHandle}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
