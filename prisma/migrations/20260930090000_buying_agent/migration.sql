-- CreateEnum
CREATE TYPE "AgentMandateStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "AgentDecisionStatus" AS ENUM ('PROPOSED', 'EXECUTED', 'SKIPPED', 'DECLINED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'AGENT_PROPOSAL';
ALTER TYPE "NotificationType" ADD VALUE 'AGENT_PURCHASE';
ALTER TYPE "NotificationType" ADD VALUE 'AGENT_FAILED';

-- AlterTable
ALTER TABLE "EscrowTransaction" ADD COLUMN     "payerWalletAddress" TEXT;

-- CreateTable
CREATE TABLE "AgentWallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AgentWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMandate" (
    "id" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "AgentMandateStatus" NOT NULL DEFAULT 'ACTIVE',
    "query" TEXT NOT NULL,
    "game" "CardGame",
    "gradingCompanies" "GradingCompany"[],
    "minGrade" DOUBLE PRECISION,
    "blackLabelOnly" BOOLEAN NOT NULL DEFAULT false,
    "maxPriceThb" INTEGER NOT NULL,
    "budgetThb" INTEGER NOT NULL,
    "maxCards" INTEGER NOT NULL DEFAULT 1,
    "spentThb" INTEGER NOT NULL DEFAULT 0,
    "boughtCount" INTEGER NOT NULL DEFAULT 0,
    "trustedSellersOnly" BOOLEAN NOT NULL DEFAULT false,
    "autoBuy" BOOLEAN NOT NULL DEFAULT false,
    "fulfillment" "FulfillmentChoice" NOT NULL DEFAULT 'VAULT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastScannedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "AgentMandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "status" "AgentDecisionStatus" NOT NULL,
    "priceThb" INTEGER NOT NULL,
    "fairValueThb" INTEGER,
    "confidence" TEXT,
    "reasoning" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "mandateId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "escrowTxId" TEXT,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_address_key" ON "AgentWallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_userId_key" ON "AgentWallet"("userId");

-- CreateIndex
CREATE INDEX "AgentMandate_status_idx" ON "AgentMandate"("status");

-- CreateIndex
CREATE INDEX "AgentMandate_userId_idx" ON "AgentMandate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDecision_escrowTxId_key" ON "AgentDecision"("escrowTxId");

-- CreateIndex
CREATE INDEX "AgentDecision_mandateId_createdAt_idx" ON "AgentDecision"("mandateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDecision_mandateId_assetId_priceThb_key" ON "AgentDecision"("mandateId", "assetId", "priceThb");

-- AddForeignKey
ALTER TABLE "AgentWallet" ADD CONSTRAINT "AgentWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "AgentMandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_escrowTxId_fkey" FOREIGN KEY ("escrowTxId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

