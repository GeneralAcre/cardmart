-- AlterEnum
ALTER TYPE "AgentDecisionStatus" ADD VALUE 'OFFERED';

-- AlterTable
ALTER TABLE "AgentMandate" ADD COLUMN     "makeOffers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AgentDecision" ADD COLUMN     "offerId" TEXT,
ADD COLUMN     "offerThb" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "AgentDecision_offerId_key" ON "AgentDecision"("offerId");

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
