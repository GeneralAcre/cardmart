// One-off, ADDITIVE demo-data script — like seed-trending-demo.ts, this never
// deletes anything. It adds a few cards that have changed hands between the
// seed NPC users through completed (RELEASED) vault escrow sales, so the
// Leaderboard's "Top traders" tab has real buy → sell histories to rank.
// Cards whose serial already exists are skipped, so re-running is safe.
// Never part of any production code path; run manually with
// `npx tsx scripts/seed-traders-demo.ts`.
import { PrismaClient, type CardGame, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB } from "../lib/pricing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

interface DemoTradedCard {
  name: string;
  subtitle: string;
  game?: CardGame;
  gradingCompany: GradingCompany;
  grade: number;
  serial: string;
  themeIndex: number;
  minterHandle: string;
  /** Ordered completed sales: [daysAgo, sellerHandle, buyerHandle, priceThb]. */
  sales: [number, string, string, number][];
  /** Current owner's asking price, or null when they're just holding it unlisted. */
  listedThb: number | null;
}

const DEMO_CARDS: DemoTradedCard[] = [
  {
    name: "Charizard Holo",
    subtitle: "Base Set — 1999",
    gradingCompany: "PSA",
    grade: 9,
    serial: "DEMO-TRD-PSA-81220417",
    themeIndex: 3,
    minterHandle: "araya",
    sales: [
      [80, "araya", "chalit", 118000],
      [35, "chalit", "nattapong", 164000],
    ],
    listedThb: 189000,
  },
  {
    name: "Pikachu Illustrator Promo Reprint",
    subtitle: "Scarlet & Violet Promos",
    gradingCompany: "PSA",
    grade: 10,
    serial: "DEMO-TRD-PSA-81220533",
    themeIndex: 5,
    minterHandle: "nattapong",
    sales: [
      [70, "nattapong", "araya", 21000],
      [28, "araya", "chalit", 34500],
      [6, "chalit", "araya", 41000],
    ],
    listedThb: 47000,
  },
  {
    name: "Roronoa Zoro Alt Art",
    subtitle: "Romance Dawn — OP01",
    game: "ONE_PIECE",
    gradingCompany: "BGS",
    grade: 9.5,
    serial: "DEMO-TRD-BGS-55102938",
    themeIndex: 2,
    minterHandle: "chalit",
    sales: [
      [60, "chalit", "nattapong", 38000],
      [18, "nattapong", "araya", 31000],
    ],
    listedThb: null,
  },
  {
    name: "Rayquaza Gold Star",
    subtitle: "EX Deoxys — 2005",
    gradingCompany: "PSA",
    grade: 8,
    serial: "DEMO-TRD-PSA-81221190",
    themeIndex: 4,
    minterHandle: "araya",
    sales: [
      [55, "araya", "nattapong", 72000],
      [12, "nattapong", "chalit", 96000],
    ],
    listedThb: 92000,
  },
  {
    name: "Nami Manga Rare",
    subtitle: "Wings of the Captain — OP06",
    game: "ONE_PIECE",
    gradingCompany: "PSA",
    grade: 10,
    serial: "DEMO-TRD-PSA-81221342",
    themeIndex: 1,
    minterHandle: "nattapong",
    sales: [[40, "nattapong", "chalit", 26000]],
    listedThb: 33000,
  },
];

async function main() {
  const handles = [...new Set(DEMO_CARDS.flatMap((c) => [c.minterHandle, ...c.sales.flatMap(([, s, b]) => [s, b])]))];
  const users = await prisma.user.findMany({ where: { handle: { in: handles } } });
  const userByHandle = new Map(users.map((u) => [u.handle!, u]));
  for (const h of handles) {
    if (!userByHandle.has(h)) throw new Error(`Seed user "${h}" not found — run prisma/seed.ts first.`);
  }
  const id = (handle: string) => userByHandle.get(handle)!.id;

  for (const c of DEMO_CARDS) {
    if (await prisma.asset.findUnique({ where: { serial: c.serial } })) {
      console.log(`Skipped ${c.name} (${c.serial}) — already exists.`);
      continue;
    }
    const [firstSaleOffset] = c.sales[0];
    const mintedDaysAgo = firstSaleOffset + 5;
    const lastBuyer = c.sales[c.sales.length - 1][2];

    const asset = await prisma.asset.create({
      data: {
        name: c.name,
        subtitle: c.subtitle,
        category: "TRADING_CARD",
        game: c.game ?? "POKEMON",
        gradingCompany: c.gradingCompany,
        grade: c.grade,
        serial: c.serial,
        themeIndex: c.themeIndex,
        priceThb: c.listedThb,
        forSale: c.listedThb != null,
        vaulted: true,
        marketStatus: "IN_VAULT",
        pipelineStage: "NONE",
        mockMintTx: mockTxSignature(),
        verificationPackage: "SELF_MINT",
        mintFeeThb: SELF_MINT_FEE_THB,
        sellerId: id(lastBuyer),
        ownerId: id(lastBuyer),
        createdAt: daysAgo(mintedDaysAgo),
      },
    });

    await prisma.provenanceEvent.create({
      data: {
        assetId: asset.id,
        type: "MINTED_DIGITAL_TWIN",
        note: `Self-Mint package: digital twin registered from ${c.gradingCompany} certificate ${c.serial} (${SELF_MINT_FEE_THB.toLocaleString()} THB fee).`,
        mockTxSignature: asset.mockMintTx,
        actorId: id(c.minterHandle),
        createdAt: daysAgo(mintedDaysAgo),
      },
    });

    // Each sale: listed by the seller, bought into the vault, released.
    const snapshots: { priceThb: number; createdAt: Date }[] = [];
    for (const [offset, seller, buyer, priceThb] of c.sales) {
      const listedAt = daysAgo(offset + 3);
      snapshots.push({ priceThb, createdAt: listedAt });
      await prisma.escrowTransaction.create({
        data: {
          assetId: asset.id,
          buyerId: id(buyer),
          sellerId: id(seller),
          amountThb: priceThb,
          fulfillmentChoice: "VAULT",
          status: "RELEASED",
          createdAt: daysAgo(offset + 1),
          releasedAt: daysAgo(offset),
        },
      });
      await prisma.provenanceEvent.createMany({
        data: [
          { type: "LISTED" as const, note: `Listed for sale at ${priceThb.toLocaleString()} THB.`, actor: seller, at: listedAt },
          { type: "ESCROW_LOCKED" as const, note: `Buyer payment of ${priceThb.toLocaleString()} THB locked in escrow.`, actor: buyer, at: daysAgo(offset + 1) },
          { type: "OWNERSHIP_TRANSFERRED" as const, note: "Vault custody unchanged; digital ownership transferred to buyer and escrow released to seller.", actor: null, at: daysAgo(offset) },
        ].map((e) => ({
          assetId: asset.id,
          type: e.type,
          note: e.note,
          mockTxSignature: mockTxSignature(),
          actorId: e.actor ? id(e.actor) : null,
          createdAt: e.at,
        })),
      });
    }
    if (c.listedThb != null) {
      const relistedAt = daysAgo(Math.max(c.sales[c.sales.length - 1][0] - 2, 0));
      snapshots.push({ priceThb: c.listedThb, createdAt: relistedAt });
      await prisma.provenanceEvent.create({
        data: {
          assetId: asset.id,
          type: "RELISTED",
          note: `Relisted for sale at ${c.listedThb.toLocaleString()} THB.`,
          mockTxSignature: mockTxSignature(),
          actorId: id(lastBuyer),
          createdAt: relistedAt,
        },
      });
    }
    await prisma.priceSnapshot.createMany({ data: snapshots.map((s) => ({ assetId: asset.id, ...s })) });

    console.log(`Created ${c.name} (${c.serial}) — ${c.sales.length} sale(s), now owned by @${lastBuyer}.`);
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
