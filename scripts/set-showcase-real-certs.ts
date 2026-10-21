// One-off: gives the showcase demo cards (scripts/add-showcase-demo.ts) real
// PSA cert numbers, so the slab label shows a real cert and the item page's
// "View on PSA" link opens PSA's own page for that exact slab, with PSA's
// photos of it. Each cert below was checked on psacard.com to be this card,
// and the grade is set to match what PSA recorded. Only touches demo rows
// (serials containing "SHOW"); prices stay mock. Safe to re-run.
//
//   npx tsx scripts/set-showcase-real-certs.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

const UPDATES: { from: string; cert: string; grade: number; priceHistory?: [number, number][] }[] = [
  // 1999 Pokemon Game #4 Charizard-Holo, 1st Edition — MINT 9
  { from: "PSA-SHOW000001", cert: "21501378", grade: 9 },
  // 1999 Pokemon Game #10 Mewtwo-Holo, 1st Edition — NM-MT+ 8.5
  { from: "PSA-SHOW000002", cert: "27341158", grade: 8.5, priceHistory: [[21, 54_000], [4, 52_000]] },
  // 2022 Pokemon Sword & Shield Lost Origin #186 FA/Giratina V — MINT 9
  { from: "PSA-SHOW000004", cert: "103458156", grade: 9, priceHistory: [[14, 19_500], [2, 21_000]] },
  // 2019 Pokemon Sun & Moon Team Up #165 Gengar & Mimikyu GX, full art — GEM MT 10
  { from: "PSA-SHOW000006", cert: "163018382", grade: 10 },
  // 2022 One Piece OP01-Romance Dawn #016 Nami, Alternate Art — GEM MT 10
  { from: "PSA-SHOW000009", cert: "124739020", grade: 10 },
];

async function main() {
  for (const u of UPDATES) {
    const serial = `PSA-${u.cert}`;
    const asset =
      (await prisma.asset.findUnique({ where: { serial: u.from } })) ?? (await prisma.asset.findUnique({ where: { serial } }));
    if (!asset) {
      console.log(`skip  ${u.from} — not found`);
      continue;
    }
    const priceThb = u.priceHistory ? u.priceHistory[u.priceHistory.length - 1][1] : asset.priceThb;
    await prisma.asset.update({ where: { id: asset.id }, data: { serial, grade: u.grade, priceThb } });
    if (u.priceHistory) {
      await prisma.priceSnapshot.deleteMany({ where: { assetId: asset.id } });
      await prisma.priceSnapshot.createMany({
        data: u.priceHistory.map(([days, price]) => ({ assetId: asset.id, priceThb: price, createdAt: daysAgo(days) })),
      });
    }
    console.log(`set   ${asset.name} → PSA ${u.cert}, grade ${u.grade}${u.priceHistory ? `, ${priceThb?.toLocaleString()} THB` : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
