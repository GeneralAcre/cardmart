import { PrismaClient, type AssetCategory, type GradingCompany } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { mockPublicKey, mockTxSignature } from "../lib/web3/mock-chain";
import { SELF_MINT_FEE_THB, FULL_SERVICE_PACKAGE_PRICE_THB } from "../lib/pricing";
import { getVerificationChecklist } from "../lib/verification-checklist";

// 1x1 placeholder pixel standing in for a real live-camera capture in seed data.
const PLACEHOLDER_CAPTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

async function main() {
  await prisma.gradingSubmission.deleteMany();
  await prisma.inboundPackage.deleteMany();
  await prisma.escrowTransaction.deleteMany();
  await prisma.provenanceEvent.deleteMany();
  await prisma.verificationPhoto.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();

  const you = await prisma.user.create({
    data: { name: "Kade Anuwat", handle: "you", walletMock: mockPublicKey() },
  });
  const nattapong = await prisma.user.create({
    data: { name: "Nattapong S.", handle: "nattapong", walletMock: mockPublicKey() },
  });
  const araya = await prisma.user.create({
    data: { name: "Araya P.", handle: "araya", walletMock: mockPublicKey() },
  });
  const chalit = await prisma.user.create({
    data: { name: "Chalit W.", handle: "chalit", walletMock: mockPublicKey() },
  });

  type SeedAsset = {
    name: string;
    subtitle: string;
    category: AssetCategory;
    gradingCompany: GradingCompany;
    grade: number | null;
    serial: string;
    themeIndex: number;
    priceThb: number | null;
    forSale: boolean;
    vaulted: boolean;
    marketStatus: "READY_TO_SHIP" | "IN_VAULT" | "IN_ESCROW" | "DELISTED";
    pipelineStage:
      | "NONE"
      | "AWAITING_SELLER_SHIPMENT"
      | "IN_TRANSIT_TO_WAREHOUSE"
      | "IN_INSPECTION"
      | "REJECTED"
      | "IN_TRANSIT_TO_BUYER"
      | "DELIVERED";
    sellerId: string;
    ownerId: string;
    verificationPackage?: "SELF_MINT" | "FULL_SERVICE";
  };

  const assets: SeedAsset[] = [
    {
      name: "Charizard VMAX Rainbow Rare",
      subtitle: "Sword & Shield — Evolving Skies",
      category: "TRADING_CARD",
      gradingCompany: "PSA",
      grade: 10,
      serial: "PSA-84920193",
      themeIndex: 0,
      priceThb: 185000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: nattapong.id,
      ownerId: nattapong.id,
    },
    {
      name: "Umbreon VMAX Alt Art",
      subtitle: "Sword & Shield — Evolving Skies",
      category: "TRADING_CARD",
      gradingCompany: "BGS",
      grade: 9.5,
      serial: "BGS-55102847",
      themeIndex: 1,
      priceThb: 94000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: araya.id,
      ownerId: araya.id,
    },
    {
      name: "Michael Jordan Rookie Card",
      subtitle: "Fleer Basketball — 1986",
      category: "SPORTS_CARD",
      gradingCompany: "PSA",
      grade: 9,
      serial: "PSA-11238475",
      themeIndex: 2,
      priceThb: 650000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: nattapong.id,
      ownerId: nattapong.id,
      verificationPackage: "FULL_SERVICE",
    },
    {
      name: "Phra Somdej Wat Rakang",
      subtitle: "Somdej Toh Prohmrangsi — B.E. 2411",
      category: "AMULET",
      gradingCompany: "CGC",
      grade: 9,
      serial: "CGC-30019284",
      themeIndex: 3,
      priceThb: 45000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: you.id,
      ownerId: you.id,
    },
    {
      name: "Luang Pu Thuat",
      subtitle: "Wat Chang Hai — B.E. 2497",
      category: "AMULET",
      gradingCompany: "PSA",
      grade: 8,
      serial: "PSA-77123001",
      themeIndex: 4,
      priceThb: 28000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: araya.id,
      ownerId: araya.id,
    },
    {
      name: "Phra Rod",
      subtitle: "Wat Phra Sing — Lamphun",
      category: "AMULET",
      gradingCompany: "PSA",
      grade: 7,
      serial: "PSA-77123099",
      themeIndex: 5,
      priceThb: 18000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: chalit.id,
      ownerId: chalit.id,
    },
    {
      name: "Lugia Holo 1st Edition",
      subtitle: "Neo Genesis — 2000",
      category: "TRADING_CARD",
      gradingCompany: "PSA",
      grade: 10,
      serial: "PSA-90441829",
      themeIndex: 6,
      priceThb: 310000,
      forSale: false,
      vaulted: false,
      marketStatus: "IN_ESCROW",
      pipelineStage: "AWAITING_SELLER_SHIPMENT",
      sellerId: nattapong.id,
      ownerId: nattapong.id,
    },
    {
      name: "Kobe Bryant Chrome Refractor",
      subtitle: "Topps Chrome — 1996",
      category: "SPORTS_CARD",
      gradingCompany: "PSA",
      grade: 9.5,
      serial: "PSA-66271940",
      themeIndex: 7,
      priceThb: 210000,
      forSale: false,
      vaulted: false,
      marketStatus: "IN_ESCROW",
      pipelineStage: "IN_INSPECTION",
      sellerId: chalit.id,
      ownerId: chalit.id,
    },
    {
      name: "Blastoise Holo 1st Edition",
      subtitle: "Base Set — 1999",
      category: "TRADING_CARD",
      gradingCompany: "PSA",
      grade: 9,
      serial: "PSA-40881122",
      themeIndex: 0,
      priceThb: 155000,
      forSale: false,
      vaulted: false,
      marketStatus: "IN_ESCROW",
      pipelineStage: "IN_INSPECTION",
      sellerId: araya.id,
      ownerId: araya.id,
    },
    {
      name: "Jatukam Ramathep",
      subtitle: "Rama IX Commemorative Edition",
      category: "AMULET",
      gradingCompany: "CGC",
      grade: 8.5,
      serial: "CGC-51002733",
      themeIndex: 3,
      priceThb: null,
      forSale: false,
      vaulted: false,
      marketStatus: "DELISTED",
      pipelineStage: "DELIVERED",
      sellerId: nattapong.id,
      ownerId: you.id,
    },
    {
      name: "Michael Jordan Rookie Card",
      subtitle: "Fleer Basketball — 1986",
      category: "SPORTS_CARD",
      gradingCompany: "PSA",
      grade: 10,
      serial: "PSA-11238599",
      themeIndex: 2,
      priceThb: null,
      forSale: false,
      vaulted: true,
      marketStatus: "IN_VAULT",
      pipelineStage: "NONE",
      sellerId: araya.id,
      ownerId: you.id,
    },
    {
      name: "Umbreon VMAX Alt Art",
      subtitle: "Sword & Shield — Evolving Skies",
      category: "TRADING_CARD",
      gradingCompany: "BGS",
      grade: 9.5,
      serial: "BGS-55102900",
      themeIndex: 1,
      priceThb: 98000,
      forSale: true,
      vaulted: true,
      marketStatus: "IN_VAULT",
      pipelineStage: "NONE",
      sellerId: you.id,
      ownerId: you.id,
    },
    {
      name: "Raw Pikachu Illustrator Reprint",
      subtitle: "CoroCoro Comic Promo — unverified print run",
      category: "TRADING_CARD",
      gradingCompany: "RAW",
      grade: null,
      serial: "RAW-DEMO0001",
      themeIndex: 4,
      priceThb: 12000,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: chalit.id,
      ownerId: chalit.id,
    },
    {
      name: "Raw Phra Somdej Reproduction",
      subtitle: "Modern reproduction, no formal certification",
      category: "AMULET",
      gradingCompany: "RAW",
      grade: null,
      serial: "RAW-DEMO0002",
      themeIndex: 6,
      priceThb: 3500,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      sellerId: araya.id,
      ownerId: araya.id,
    },
  ];

  const created = new Map<string, string>();
  for (const a of assets) {
    const verificationPackage = a.verificationPackage ?? "SELF_MINT";
    const mintFeeThb =
      verificationPackage === "FULL_SERVICE" ? FULL_SERVICE_PACKAGE_PRICE_THB : SELF_MINT_FEE_THB;
    const asset = await prisma.asset.create({
      data: {
        name: a.name,
        subtitle: a.subtitle,
        category: a.category,
        gradingCompany: a.gradingCompany,
        grade: a.grade,
        serial: a.serial,
        themeIndex: a.themeIndex,
        priceThb: a.priceThb,
        forSale: a.forSale,
        vaulted: a.vaulted,
        marketStatus: a.marketStatus,
        pipelineStage: a.pipelineStage,
        mockMintTx: mockTxSignature(),
        verificationPackage,
        mintFeeThb,
        sellerId: a.sellerId,
        ownerId: a.ownerId,
        createdAt: daysAgo(30),
      },
    });
    created.set(a.serial, asset.id);

    if (verificationPackage === "SELF_MINT") {
      const checklist = getVerificationChecklist(a.category, a.gradingCompany === "RAW");
      await prisma.verificationPhoto.createMany({
        data: checklist.map((v) => ({
          assetId: asset.id,
          viewKey: v.key,
          viewLabel: v.label,
          dataUrl: PLACEHOLDER_CAPTURE,
        })),
      });
    }

    await prisma.provenanceEvent.create({
      data: {
        assetId: asset.id,
        type: "MINTED_DIGITAL_TWIN",
        note:
          verificationPackage === "FULL_SERVICE"
            ? `Full-Service package: platform shipped the raw item to ${a.gradingCompany}, covered the ${a.gradingCompany} grading fee, and minted the digital twin (${mintFeeThb.toLocaleString()} THB package).`
            : a.gradingCompany === "RAW"
              ? `Self-Mint package: raw/ungraded item verified by live camera only — no grading company involved (${mintFeeThb.toLocaleString()} THB fee).`
              : `Self-Mint package: digital twin registered from ${a.gradingCompany} certificate ${a.serial} (${mintFeeThb.toLocaleString()} THB fee).`,
        mockTxSignature: asset.mockMintTx,
        actorId: a.sellerId,
        createdAt: daysAgo(30),
      },
    });
    if (a.forSale || a.marketStatus !== "DELISTED") {
      await prisma.provenanceEvent.create({
        data: {
          assetId: asset.id,
          type: "LISTED",
          note: a.priceThb
            ? `Listed for sale at ${a.priceThb.toLocaleString()} THB.`
            : "Listed for sale.",
          mockTxSignature: mockTxSignature(),
          actorId: a.sellerId,
          createdAt: daysAgo(25),
        },
      });
    }
  }

  // Escrow #1: Lugia — buyer "you", awaiting seller shipment to warehouse.
  const lugiaId = created.get("PSA-90441829")!;
  await prisma.escrowTransaction.create({
    data: {
      assetId: lugiaId,
      buyerId: you.id,
      sellerId: nattapong.id,
      amountThb: 310000,
      fulfillmentChoice: "SHIP",
      status: "LOCKED",
      createdAt: daysAgo(2),
    },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId: lugiaId,
      type: "ESCROW_LOCKED",
      note: "Buyer payment of 310,000 THB locked in escrow.",
      mockTxSignature: mockTxSignature(),
      actorId: you.id,
      createdAt: daysAgo(2),
    },
  });

  // Escrow #2: Kobe — buyer "you", clean match, pending inspection, VAULT choice.
  const kobeId = created.get("PSA-66271940")!;
  const escrowKobe = await prisma.escrowTransaction.create({
    data: {
      assetId: kobeId,
      buyerId: you.id,
      sellerId: chalit.id,
      amountThb: 210000,
      fulfillmentChoice: "VAULT",
      status: "LOCKED",
      createdAt: daysAgo(4),
    },
  });
  for (const [type, note, offset] of [
    ["ESCROW_LOCKED", "Buyer payment of 210,000 THB locked in escrow.", 4],
    ["SHIPPED_TO_WAREHOUSE", "Seller shipped package to platform warehouse.", 3],
  ] as const) {
    await prisma.provenanceEvent.create({
      data: {
        assetId: kobeId,
        type,
        note,
        mockTxSignature: mockTxSignature(),
        actorId: chalit.id,
        createdAt: daysAgo(offset),
      },
    });
  }
  await prisma.inboundPackage.create({
    data: {
      assetId: kobeId,
      escrowTxId: escrowKobe.id,
      declaredSerial: "PSA-66271940",
      declaredGradingCompany: "PSA",
      declaredGrade: 9.5,
      officialSerial: "PSA-66271940",
      officialGradingCompany: "PSA",
      officialGrade: 9.5,
      officialName: "Kobe Bryant Chrome Refractor",
      status: "PENDING_INSPECTION",
      arrivedAt: daysAgo(1),
    },
  });

  // Escrow #3: Blastoise — buyer "you", MISMATCH (declared grade differs from
  // the official cert lookup), pending inspection, SHIP choice.
  const blastoiseId = created.get("PSA-40881122")!;
  const escrowBlastoise = await prisma.escrowTransaction.create({
    data: {
      assetId: blastoiseId,
      buyerId: you.id,
      sellerId: araya.id,
      amountThb: 155000,
      fulfillmentChoice: "SHIP",
      status: "LOCKED",
      createdAt: daysAgo(5),
    },
  });
  for (const [type, note, offset] of [
    ["ESCROW_LOCKED", "Buyer payment of 155,000 THB locked in escrow.", 5],
    ["SHIPPED_TO_WAREHOUSE", "Seller shipped package to platform warehouse.", 3],
  ] as const) {
    await prisma.provenanceEvent.create({
      data: {
        assetId: blastoiseId,
        type,
        note,
        mockTxSignature: mockTxSignature(),
        actorId: araya.id,
        createdAt: daysAgo(offset),
      },
    });
  }
  await prisma.inboundPackage.create({
    data: {
      assetId: blastoiseId,
      escrowTxId: escrowBlastoise.id,
      declaredSerial: "PSA-40881122",
      declaredGradingCompany: "PSA",
      declaredGrade: 9,
      officialSerial: "PSA-40881122",
      officialGradingCompany: "PSA",
      officialGrade: 7,
      officialName: "Blastoise Holo 1st Edition",
      status: "PENDING_INSPECTION",
      arrivedAt: daysAgo(1),
    },
  });

  // Historical, resolved escrow for the Jatukam amulet now delivered to "you".
  const jatukamId = created.get("CGC-51002733")!;
  const escrowJatukam = await prisma.escrowTransaction.create({
    data: {
      assetId: jatukamId,
      buyerId: you.id,
      sellerId: nattapong.id,
      amountThb: 32000,
      fulfillmentChoice: "SHIP",
      status: "RELEASED",
      createdAt: daysAgo(20),
      releasedAt: daysAgo(14),
    },
  });
  await prisma.inboundPackage.create({
    data: {
      assetId: jatukamId,
      escrowTxId: escrowJatukam.id,
      declaredSerial: "CGC-51002733",
      declaredGradingCompany: "CGC",
      declaredGrade: 8.5,
      officialSerial: "CGC-51002733",
      officialGradingCompany: "CGC",
      officialGrade: 8.5,
      officialName: "Jatukam Ramathep",
      status: "APPROVED_SHIP",
      arrivedAt: daysAgo(17),
      resolvedAt: daysAgo(16),
    },
  });
  for (const [type, note, offset, actorId] of [
    ["ESCROW_LOCKED", "Buyer payment of 32,000 THB locked in escrow.", 20, you.id],
    ["SHIPPED_TO_WAREHOUSE", "Seller shipped package to platform warehouse.", 18, nattapong.id],
    ["INSPECTION_PASSED", "Serial and slab authenticity verified against CGC database.", 16, undefined],
    ["DELIVERED_TO_BUYER", "Package delivered to buyer's address.", 14, undefined],
    ["OWNERSHIP_TRANSFERRED", "Digital ownership transferred to buyer; escrow released to seller.", 14, undefined],
  ] as const) {
    await prisma.provenanceEvent.create({
      data: {
        assetId: jatukamId,
        type,
        note,
        mockTxSignature: mockTxSignature(),
        actorId: actorId ?? null,
        createdAt: daysAgo(offset),
      },
    });
  }

  // Historical resolved escrow for the vaulted Jordan card (instant vault
  // deposit path) now owned by "you".
  const jordanVaultId = created.get("PSA-11238599")!;
  await prisma.escrowTransaction.create({
    data: {
      assetId: jordanVaultId,
      buyerId: you.id,
      sellerId: araya.id,
      amountThb: 720000,
      fulfillmentChoice: "VAULT",
      status: "RELEASED",
      createdAt: daysAgo(45),
      releasedAt: daysAgo(40),
    },
  });
  for (const [type, note, offset, actorId] of [
    ["ESCROW_LOCKED", "Buyer payment of 720,000 THB locked in escrow.", 45, you.id],
    ["SHIPPED_TO_WAREHOUSE", "Seller shipped package to platform warehouse.", 43, araya.id],
    ["INSPECTION_PASSED", "Serial and slab authenticity verified against PSA database.", 41, undefined],
    ["DEPOSITED_TO_VAULT", "Physical item deposited into the platform vault.", 40, undefined],
    ["OWNERSHIP_TRANSFERRED", "Digital ownership transferred to buyer; escrow released to seller.", 40, undefined],
  ] as const) {
    await prisma.provenanceEvent.create({
      data: {
        assetId: jordanVaultId,
        type,
        note,
        mockTxSignature: mockTxSignature(),
        actorId: actorId ?? null,
        createdAt: daysAgo(offset),
      },
    });
  }

  // Umbreon vaulted-and-relisted: instant-trade history.
  const umbreonVaultId = created.get("BGS-55102900")!;
  await prisma.provenanceEvent.create({
    data: {
      assetId: umbreonVaultId,
      type: "RELISTED",
      note: "Relisted for instant sale directly from the vault.",
      mockTxSignature: mockTxSignature(),
      actorId: you.id,
      createdAt: daysAgo(6),
    },
  });

  // Full-Service grading submissions: raw/ungraded items paid for and sent
  // out by the platform, not yet resolved into a listed Asset.
  await prisma.gradingSubmission.create({
    data: {
      itemName: "Raw Naruto Shippuden Kayou Tier 1",
      itemSubtitle: "Seller believes this is a rare parallel, ungraded",
      category: "TRADING_CARD",
      gradingCompany: "PSA",
      packagePriceThb: FULL_SERVICE_PACKAGE_PRICE_THB,
      status: "AWAITING_SHIPMENT_TO_GRADER",
      mockPaymentTx: mockTxSignature(),
      sellerId: chalit.id,
      createdAt: daysAgo(1),
    },
  });
  await prisma.gradingSubmission.create({
    data: {
      itemName: "Raw Phra Kring Pavares",
      itemSubtitle: "Wat Bovoranives — believed B.E. 2485, ungraded",
      category: "AMULET",
      gradingCompany: "CGC",
      packagePriceThb: FULL_SERVICE_PACKAGE_PRICE_THB,
      status: "AT_GRADING_COMPANY",
      mockPaymentTx: mockTxSignature(),
      sellerId: araya.id,
      createdAt: daysAgo(4),
    },
  });

  console.log(`Seeded ${assets.length} assets, 4 users, 2 grading submissions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
