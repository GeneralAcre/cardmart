// One-off, ADDITIVE demo-data script — adds a few One Piece Card Game listings
// to the existing demo sellers so the One Piece filter isn't empty. Never
// deletes anything, and skips any card whose serial already exists, so it's
// safe to re-run. Run manually:
//
//   npx tsx scripts/add-one-piece-demo.ts
import { PrismaClient, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { put } from "@vercel/blob";
import "dotenv/config";
import { mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB } from "../lib/pricing";
import { getVerificationChecklist } from "../lib/verification-checklist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Same stand-in capture as prisma/seed.ts — demo listings go through the same
// storage path as real uploads, without pretending to be real photos.
const PLACEHOLDER_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

interface DemoCard {
  name: string;
  subtitle: string;
  gradingCompany: GradingCompany;
  grade: number;
  serial: string;
  themeIndex: number;
  sellerHandle: string;
  vaulted: boolean;
  /** Ordered price history — last entry is the listed price. Each entry is [daysAgo, priceThb]. */
  priceHistory: [number, number][];
}

const CARDS: DemoCard[] = [
  {
    name: "Monkey.D.Luffy Manga Rare",
    subtitle: "Awakening of the New Era — OP05",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-OP05119001",
    themeIndex: 3,
    sellerHandle: "nattapong",
    vaulted: true,
    priceHistory: [[9, 48000], [3, 52000]],
  },
  {
    name: "Shanks Manga Rare",
    subtitle: "Romance Dawn — OP01",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-OP01120001",
    themeIndex: 5,
    sellerHandle: "araya",
    vaulted: false,
    priceHistory: [[12, 72000], [2, 68000]],
  },
  {
    name: "Roronoa Zoro Alternate Art",
    subtitle: "Romance Dawn — OP01",
    gradingCompany: "BGS",
    grade: 9.5,
    serial: "BGS-OP01025001",
    themeIndex: 1,
    sellerHandle: "chalit",
    vaulted: true,
    priceHistory: [[8, 8800], [1, 9500]],
  },
  {
    name: "Yamato Alternate Art",
    subtitle: "Romance Dawn — OP01",
    gradingCompany: "PSA",
    grade: 9,
    serial: "PSA-OP01121001",
    themeIndex: 7,
    sellerHandle: "araya",
    vaulted: false,
    priceHistory: [[5, 3800]],
  },
];

async function main() {
  const { url: placeholderPhotoUrl } = await put("seed/placeholder.png", PLACEHOLDER_PIXEL_PNG, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

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

    const listedAt = daysAgo(card.priceHistory[0][0]);
    const priceThb = card.priceHistory[card.priceHistory.length - 1][1];
    const mintTx = mockTxSignature();
    const asset = await prisma.asset.create({
      data: {
        name: card.name,
        subtitle: card.subtitle,
        category: "TRADING_CARD",
        game: "ONE_PIECE",
        gradingCompany: card.gradingCompany,
        grade: card.grade,
        serial: card.serial,
        themeIndex: card.themeIndex,
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
          note: `Self-Mint package: digital twin registered from ${card.gradingCompany} certificate ${card.serial} (${SELF_MINT_FEE_THB} THB fee).`,
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
    console.log(`added ${card.name} (${card.serial}) — ${priceThb.toLocaleString()} THB, @${card.sellerHandle}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
