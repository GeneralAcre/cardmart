// One-off demo-data script: gives the seeded demo cards a real devnet NFT, so
// buying one on the live site delivers a real token that can be checked on
// Solana Explorer, the same as a card a real seller lists.
//
// The demo sellers are seed accounts with no wallet of their own, so their
// cards are held in the platform's custody: each twin is minted into the
// escrow authority's wallet and the seller's walletAddress is set to it. The
// authority can then move the twin to a buyer as its owner, with no separate
// approval (see isTransferDelegated in lib/web3/token-server.ts). A card in
// custody is in the vault, so it's marked vaulted: buying it settles at once
// (buyer pays SOL into escrow, the NFT moves, escrow releases) instead of
// waiting on a demo seller who will never ship.
//
// Skips cards that already have a mint, redeemed cards, and cards owned by
// real (Privy) accounts. Cheapest cards first, since those are the ones a
// tester can afford with faucet SOL. Stops while the authority still has
// RESERVE_SOL (override with MINT_RESERVE_SOL) for settlements, so it's safe
// to re-run after topping up the authority wallet.
//
//   npx tsx scripts/mint-demo-twins.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Rough cost of one twin: mint + token account rent, Metaplex metadata and
// master edition rent, plus fees.
const MINT_COST_SOL = 0.017;
const RESERVE_SOL = Number(process.env.MINT_RESERVE_SOL ?? 0.03);
// Mid-sale cards keep their status; everything else in custody is vaulted.
const VAULTABLE = ["READY_TO_SHIP", "IN_VAULT", "DELISTED"] as const;

function nftName(cardName: string, gradingCompany: string, grade: number | null): string {
  const tier = gradingCompany === "RAW" || grade == null ? "Raw" : `${gradingCompany} ${Number.isInteger(grade) ? grade : grade.toFixed(1)}`;
  return `${tier} · ${cardName}`;
}

async function main() {
  // Imported here so dotenv has loaded the authority key and RPC URL first.
  const { getEscrowAuthorityAddress, rpc } = await import("../lib/web3/authority-server");
  const { mintDigitalTwinToken } = await import("../lib/web3/token-server");
  const { address } = await import("@solana/kit");

  const authority = await getEscrowAuthorityAddress();
  if (!authority) throw new Error("ESCROW_AUTHORITY_SECRET_KEY is not configured.");

  const authorityAddr = address(authority);

  // Twins already minted into custody (an earlier run) belong in the vault too.
  const vaulted = await prisma.asset.updateMany({
    where: {
      mintAddress: { not: null },
      vaulted: false,
      redeemedAt: null,
      marketStatus: { in: [...VAULTABLE] },
      owner: { privyUserId: null, walletAddress: authority },
    },
    data: { vaulted: true, marketStatus: "IN_VAULT", pipelineStage: "NONE" },
  });
  if (vaulted.count) console.log(`Moved ${vaulted.count} custody card(s) into the vault.`);

  const assets = await prisma.asset.findMany({
    where: { mintAddress: null, redeemedAt: null, owner: { privyUserId: null } },
    // Cards on the market first, cheapest first.
    orderBy: [{ forSale: "desc" }, { priceThb: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, gradingCompany: true, grade: true, ownerId: true, marketStatus: true, owner: { select: { handle: true, walletAddress: true } } },
  });
  console.log(`${assets.length} demo card(s) without an NFT.`);

  for (const asset of assets) {
    const balance = Number((await rpc.getBalance(authorityAddr).send()).value) / 1e9;
    if (balance < MINT_COST_SOL + RESERVE_SOL) {
      console.log(`Stopping: authority has ${balance.toFixed(4)} SOL. Top up ${authority} on devnet and re-run.`);
      break;
    }
    if (asset.owner.walletAddress && asset.owner.walletAddress !== authority) {
      console.log(`Skipping ${asset.name}: @${asset.owner.handle} has a different wallet.`);
      continue;
    }
    if (!asset.owner.walletAddress) {
      await prisma.user.update({ where: { id: asset.ownerId }, data: { walletAddress: authority } });
    }

    const minted = await mintDigitalTwinToken({
      ownerAddress: authority,
      name: nftName(asset.name, asset.gradingCompany, asset.grade),
    });
    await prisma.$transaction([
      prisma.asset.update({
        where: { id: asset.id },
        data: {
          mintAddress: minted.mintAddress,
          mockMintTx: minted.txSignature,
          transferApproved: true,
          ...((VAULTABLE as readonly string[]).includes(asset.marketStatus)
            ? { vaulted: true, marketStatus: "IN_VAULT" as const, pipelineStage: "NONE" as const }
            : {}),
        },
      }),
      prisma.provenanceEvent.create({
        data: {
          assetId: asset.id,
          type: "MINTED_DIGITAL_TWIN",
          note: "Digital twin minted on Solana devnet as a 1-of-1 NFT, held in CardMart custody.",
          mockTxSignature: minted.txSignature,
          onChain: true,
          actorId: asset.ownerId,
        },
      }),
    ]);
    console.log(`Minted ${asset.name} → ${minted.mintAddress}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
