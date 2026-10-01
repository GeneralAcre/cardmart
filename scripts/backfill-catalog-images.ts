// One-off: looks up the official catalogue image and card number
// (lib/card-catalog.ts) for every asset missing either. One TCG API request
// per distinct card (name + set + game), not per asset, to stay inside the
// 100/day quota. Safe to re-run — only empty fields are filled.
//
//   npx tsx scripts/backfill-catalog-images.ts [--dry-run]
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { findCatalogCard } from "../lib/card-catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const assets = await prisma.asset.findMany({
    where: { OR: [{ catalogImageUrl: null }, { cardNumber: null }] },
    select: { id: true, name: true, subtitle: true, game: true, catalogImageUrl: true, cardNumber: true },
  });
  const groups = new Map<string, typeof assets>();
  for (const a of assets) {
    const key = `${a.game}|${a.name}|${a.subtitle}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  console.log(`${assets.length} asset(s) missing an image or number, ${groups.size} distinct card(s) to look up.`);
  if (process.argv.includes("--dry-run")) return;

  for (const list of groups.values()) {
    const { name, subtitle, game } = list[0];
    const card = await findCatalogCard({ name, subtitle, game });
    if (!card) {
      console.log(`  no confident match — ${name} (${subtitle})`);
      continue;
    }
    const ids = list.map((a) => a.id);
    await prisma.asset.updateMany({ where: { id: { in: ids }, catalogImageUrl: null }, data: { catalogImageUrl: card.imageUrl } });
    if (card.number) {
      await prisma.asset.updateMany({ where: { id: { in: ids }, cardNumber: null }, data: { cardNumber: card.number } });
    }
    console.log(`  ✓ ${name} (${subtitle}) → #${card.number ?? "?"}, ${list.length} asset(s)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
