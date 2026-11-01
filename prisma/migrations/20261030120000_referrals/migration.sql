-- Referrals: who invited each user, from the /?ref=<handle> link they opened
-- before first signing in. Existing users weren't referred by anyone.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
