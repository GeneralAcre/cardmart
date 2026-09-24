// One-off, ADDITIVE demo-data script — unlike prisma/seed.ts, this never
// deletes anything. It only adds a few new for-sale listings (owned by the
// existing seed NPC sellers) with real PriceSnapshot histories, so the
// Marketplace's "Trending" section has genuine gainers to show. Re-run it
// whenever Trending disappears (after a reseed, or once the history is more
// than 7 days old). Never part
// of any production code path; run manually with `npx tsx scripts/seed-trending-demo.ts`.
import { PrismaClient, type AssetCategory, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB } from "../lib/pricing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

interface DemoAsset {
  name: string;
  subtitle: string;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number;
  serial: string;
  themeIndex: number;
  sellerHandle: string;
  /** Real, ordered price history — last entry is the current/listed price. Each entry is [daysAgo, priceThb]. */
  priceHistory: [number, number][];
}

const DEMO_ASSETS: DemoAsset[] = [
  {
    name: "Umbreon VMAX Alt Art",
    subtitle: "Sword & Shield — Evolving Skies",
    category: "TRADING_CARD",
    gradingCompany: "BGS",
    grade: 9.5,
    serial: "BGS-70213847",
    themeIndex: 1,
    sellerHandle: "araya",
    priceHistory: [
      [6, 72000],
      [4, 78000],
      [2, 85000],
      [0, 94000],
    ],
  },
  {
    name: "Michael Jordan Rookie Card",
    subtitle: "Fleer Basketball — 1986",
    category: "SPORTS_CARD",
    gradingCompany: "PSA",
    grade: 9,
    serial: "PSA-58831402",
    themeIndex: 2,
    sellerHandle: "nattapong",
    priceHistory: [
      [6, 580000],
      [3, 610000],
      [0, 650000],
    ],
  },
  {
    name: "Lugia Holo 1st Edition",
    subtitle: "Neo Genesis — 2000",
    category: "TRADING_CARD",
    gradingCompany: "PSA",
    grade: 10,
    serial: "PSA-30719284",
    themeIndex: 6,
    sellerHandle: "chalit",
    priceHistory: [
      [6, 280000],
      [3, 295000],
      [0, 310000],
    ],
  },
  {
    name: "Blastoise Holo 1st Edition",
    subtitle: "Base Set — 1999",
    category: "TRADING_CARD",
    gradingCompany: "PSA",
    grade: 9,
    serial: "PSA-40881175",
    themeIndex: 0,
    sellerHandle: "araya",
    // A realistic non-gainer too — trending shouldn't be the only story.
    priceHistory: [
      [6, 160000],
      [3, 155000],
      [0, 155000],
    ],
  },
];

async function main() {
  const sellers = await prisma.user.findMany({
    where: { handle: { in: ["nattapong", "araya", "chalit"] } },
  });
  const sellerByHandle = new Map(sellers.map((s) => [s.handle!, s]));
  for (const a of DEMO_ASSETS) {
    if (!sellerByHandle.has(a.sellerHandle)) {
      throw new Error(`Seed user "${a.sellerHandle}" not found — run prisma/seed.ts first.`);
    }
  }

  for (const a of DEMO_ASSETS) {
    const existing = await prisma.asset.findUnique({ where: { serial: a.serial } });
    if (existing) {
      // Trending only counts reprices within the last 7 days, so re-running
      // this re-dates an existing demo listing's history relative to now
      // instead of skipping it and letting the section go empty again.
      await prisma.priceSnapshot.deleteMany({ where: { assetId: existing.id } });
      await prisma.priceSnapshot.createMany({
        data: a.priceHistory.map(([offset, priceThb]) => ({
          assetId: existing.id,
          priceThb,
          createdAt: daysAgo(offset),
        })),
      });
      await prisma.asset.update({
        where: { id: existing.id },
        data: { priceThb: a.priceHistory[a.priceHistory.length - 1][1], forSale: true, marketStatus: "READY_TO_SHIP" },
      });
      console.log(`Refreshed ${a.name} (${a.serial}) price history.`);
      continue;
    }

    const seller = sellerByHandle.get(a.sellerHandle)!;
    const [, currentPriceThb] = a.priceHistory[a.priceHistory.length - 1];
    const [firstOffset] = a.priceHistory[0];

    const asset = await prisma.asset.create({
      data: {
        name: a.name,
        subtitle: a.subtitle,
        category: a.category,
        gradingCompany: a.gradingCompany,
        grade: a.grade,
        serial: a.serial,
        themeIndex: a.themeIndex,
        priceThb: currentPriceThb,
        forSale: true,
        vaulted: false,
        marketStatus: "READY_TO_SHIP",
        pipelineStage: "NONE",
        mockMintTx: mockTxSignature(),
        verificationPackage: "SELF_MINT",
        mintFeeThb: SELF_MINT_FEE_THB,
        sellerId: seller.id,
        ownerId: seller.id,
        createdAt: daysAgo(firstOffset),
      },
    });

    await prisma.priceSnapshot.createMany({
      data: a.priceHistory.map(([offset, priceThb]) => ({
        assetId: asset.id,
        priceThb,
        createdAt: daysAgo(offset),
      })),
    });

    await prisma.provenanceEvent.create({
      data: {
        assetId: asset.id,
        type: "MINTED_DIGITAL_TWIN",
        note: `Self-Mint package: digital twin registered from ${a.gradingCompany} certificate ${a.serial} (${SELF_MINT_FEE_THB.toLocaleString()} THB fee).`,
        mockTxSignature: asset.mockMintTx,
        actorId: seller.id,
        createdAt: daysAgo(firstOffset),
      },
    });
    await prisma.provenanceEvent.createMany({
      data: a.priceHistory.map(([offset, priceThb], i) => ({
        assetId: asset.id,
        type: "LISTED" as const,
        note:
          i === 0
            ? `Listed for sale at ${priceThb.toLocaleString()} THB.`
            : `Price updated to ${priceThb.toLocaleString()} THB.`,
        mockTxSignature: mockTxSignature(),
        actorId: seller.id,
        createdAt: daysAgo(offset),
      })),
    });

    console.log(`Created ${a.name} (${a.serial}) — ${a.priceHistory.length} price points, now ${currentPriceThb.toLocaleString()} THB.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
