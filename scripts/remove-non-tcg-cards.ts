// One-off cleanup for the move to Pokémon + One Piece only: permanently
// deletes every asset that isn't a trading card (sports cards, comics) plus
// everything that points at it. Dry run by default — it only lists what it
// would delete; pass --apply to actually delete, in one transaction.
//
//   npx tsx scripts/remove-non-tcg-cards.ts          # preview
//   npx tsx scripts/remove-non-tcg-cards.ts --apply  # delete
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const apply = process.argv.includes("--apply");
  const assets = await prisma.asset.findMany({
    where: { category: { not: "TRADING_CARD" } },
    select: { id: true, name: true, serial: true, category: true, owner: { select: { name: true } } },
  });

  if (assets.length === 0) {
    console.log("Nothing to delete — every asset is already a trading card.");
    return;
  }
  console.log(`${apply ? "Deleting" : "Would delete"} ${assets.length} asset(s):`);
  for (const a of assets) console.log(`  - ${a.name} (${a.serial}, ${a.category}, owner ${a.owner.name})`);
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete.");
    return;
  }

  const ids = assets.map((a) => a.id);
  const escrowIds = (await prisma.escrowTransaction.findMany({ where: { assetId: { in: ids } }, select: { id: true } })).map((e) => e.id);
  const auctionIds = (await prisma.auction.findMany({ where: { assetId: { in: ids } }, select: { id: true } })).map((a) => a.id);

  // Leaf-to-root, following the restrict FKs (same order as prisma/seed.ts).
  const result = await prisma.$transaction([
    prisma.bid.deleteMany({ where: { auctionId: { in: auctionIds } } }),
    prisma.auction.deleteMany({ where: { id: { in: auctionIds } } }),
    prisma.offer.deleteMany({ where: { assetId: { in: ids } } }),
    prisma.tradeOffer.deleteMany({ where: { OR: [{ requestedAssetId: { in: ids } }, { offeredAssetId: { in: ids } }] } }),
    prisma.watchlistItem.deleteMany({ where: { assetId: { in: ids } } }),
    prisma.priceSnapshot.deleteMany({ where: { assetId: { in: ids } } }),
    prisma.gradingSubmission.updateMany({ where: { resultAssetId: { in: ids } }, data: { resultAssetId: null } }),
    prisma.inboundPackage.deleteMany({ where: { assetId: { in: ids } } }),
    prisma.review.deleteMany({ where: { escrowTxId: { in: escrowIds } } }),
    prisma.escrowTransaction.deleteMany({ where: { id: { in: escrowIds } } }),
    prisma.provenanceEvent.deleteMany({ where: { assetId: { in: ids } } }),
    prisma.verificationPhoto.deleteMany({ where: { assetId: { in: ids } } }),
    // Notifications linking to a deleted item would be dead links.
    prisma.notification.deleteMany({ where: { href: { in: ids.map((id) => `/item/${id}`) } } }),
    prisma.asset.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Done — deleted ${result[result.length - 1].count} asset(s) and their related records.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
