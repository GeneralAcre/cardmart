// Bootstraps back-office access for an existing account — the one case the
// /admin/users page can't cover, since granting staff access there needs
// someone who's already staff. The account must have signed in at least once
// so its User row exists. Run manually:
//   npx tsx scripts/make-admin.ts you@example.com      (or a @handle)
//   npx tsx scripts/make-admin.ts you@example.com --revoke
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [who, flag] = process.argv.slice(2);
  if (!who) {
    console.error("Usage: npx tsx scripts/make-admin.ts <email | @handle> [--revoke]");
    process.exit(1);
  }
  const isAdmin = flag !== "--revoke";
  const where = who.startsWith("@") ? { handle: who.slice(1) } : { email: who };

  const user = await prisma.user.findUnique({ where });
  if (!user) {
    console.error(`No account found for ${who}. Sign in to the site once first, then re-run this.`);
    process.exit(1);
  }

  await prisma.user.update({ where: { id: user.id }, data: { isAdmin } });
  console.log(`${user.name ?? user.handle ?? user.email}: staff access ${isAdmin ? "granted" : "revoked"}. Back office: /admin`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
