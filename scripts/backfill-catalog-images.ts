// One-off: looks up the official catalogue image (lib/card-catalog.ts) for
// every asset that doesn't have one yet. One TCG API request per distinct
// card (name + set + game), not per asset, to stay inside the 100/day quota.
// Safe to re-run — assets that already have an image are skipped.
//
//   npx tsx scripts/backfill-catalog-images.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { findCatalogImage } from "../lib/card-catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const assets = await prisma.asset.findMany({
    where: { catalogImageUrl: null },
    select: { id: true, name: true, subtitle: true, game: true },
  });
  const groups = new Map<string, typeof assets>();
  for (const a of assets) {
    const key = `${a.game}|${a.name}|${a.subtitle}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  console.log(`${assets.length} asset(s) without an image, ${groups.size} distinct card(s) to look up.`);

  for (const list of groups.values()) {
    const { name, subtitle, game } = list[0];
    const url = await findCatalogImage({ name, subtitle, game });
    if (!url) {
      console.log(`  no confident match — ${name} (${subtitle})`);
      continue;
    }
    await prisma.asset.updateMany({ where: { id: { in: list.map((a) => a.id) } }, data: { catalogImageUrl: url } });
    console.log(`  ✓ ${name} (${subtitle}) → ${list.length} asset(s)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
