// One-off demo-data script: gives the seeded demo cards a real devnet NFT, so
// buying one on the live site delivers a real token that can be checked on
// Solana Explorer, the same as a card a real seller lists.
//
// The demo sellers are seed accounts with no wallet of their own, so their
// cards are held in the platform's custody: each twin is minted into the
// escrow authority's wallet and the seller's walletAddress is set to it. The
// authority can then move the twin to a buyer as its owner, with no separate
// approval (see isTransferDelegated in lib/web3/token-server.ts).
//
// Skips cards that already have a mint, redeemed cards, and cards owned by
// real (Privy) accounts. Stops while the authority still has RESERVE_SOL for
// settlements, so it's safe to re-run after topping up the authority wallet.
//
//   npx tsx scripts/mint-demo-twins.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Rough cost of one twin: mint + token account rent, Metaplex metadata and
// master edition rent, plus fees.
const MINT_COST_SOL = 0.013;
const RESERVE_SOL = 0.03;

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

  const assets = await prisma.asset.findMany({
    where: { mintAddress: null, redeemedAt: null, owner: { privyUserId: null } },
    // Cards on the market first.
    orderBy: [{ forSale: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, gradingCompany: true, grade: true, ownerId: true, owner: { select: { handle: true, walletAddress: true } } },
  });
  console.log(`${assets.length} demo card(s) without an NFT.`);

  for (const asset of assets) {
    const balance = Number((await rpc.getBalance(address(authority)).send()).value) / 1e9;
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
        data: { mintAddress: minted.mintAddress, mockMintTx: minted.txSignature, transferApproved: true },
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
