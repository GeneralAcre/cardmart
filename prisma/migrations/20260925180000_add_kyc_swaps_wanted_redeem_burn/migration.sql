-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycIdType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'DRIVING_LICENSE');

-- CreateEnum
CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProvenanceType" ADD VALUE 'TOKEN_BURNED';
ALTER TYPE "ProvenanceType" ADD VALUE 'SWAPPED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WANTED_CARD_LISTED';
ALTER TYPE "NotificationType" ADD VALUE 'TRADE_OFFER_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'TRADE_OFFER_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'TRADE_OFFER_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'KYC_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'KYC_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'KYC_REJECTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kycDateOfBirth" TIMESTAMP(3),
ADD COLUMN     "kycIdLast4" TEXT,
ADD COLUMN     "kycIdType" "KycIdType",
ADD COLUMN     "kycLegalName" TEXT,
ADD COLUMN     "kycRejectReason" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "burnTxSignature" TEXT,
ADD COLUMN     "redeemedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "cashThb" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "cashOnChain" BOOLEAN NOT NULL DEFAULT false,
    "cashTradeId" BIGINT,
    "cashTradeAccount" TEXT,
    "cashLamports" BIGINT,
    "proposerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "requestedAssetId" TEXT NOT NULL,
    "offeredAssetId" TEXT NOT NULL,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WantedCard" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "gradingCompany" "GradingCompany",
    "minGrade" DOUBLE PRECISION,
    "blackLabelOnly" BOOLEAN NOT NULL DEFAULT false,
    "maxPriceThb" INTEGER,
    "trustedOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMatchedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "WantedCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeOffer_recipientId_status_idx" ON "TradeOffer"("recipientId", "status");

-- CreateIndex
CREATE INDEX "TradeOffer_proposerId_status_idx" ON "TradeOffer"("proposerId", "status");

-- CreateIndex
CREATE INDEX "TradeOffer_requestedAssetId_status_idx" ON "TradeOffer"("requestedAssetId", "status");

-- CreateIndex
CREATE INDEX "TradeOffer_offeredAssetId_status_idx" ON "TradeOffer"("offeredAssetId", "status");

-- CreateIndex
CREATE INDEX "WantedCard_userId_idx" ON "WantedCard"("userId");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_requestedAssetId_fkey" FOREIGN KEY ("requestedAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_offeredAssetId_fkey" FOREIGN KEY ("offeredAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantedCard" ADD CONSTRAINT "WantedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

