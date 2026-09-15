-- Catches up the database to schema changes made when prepping the Privy
-- swap (schema.prisma was hand-edited then, but no migration was ever
-- created for it — this migration was missing until now).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "privyUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");

-- DropTable: Auth.js (NextAuth) tables, no longer used now that Privy is
-- replacing that system entirely.
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "VerificationToken";
