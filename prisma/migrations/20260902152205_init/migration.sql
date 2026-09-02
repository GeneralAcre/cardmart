-- CreateEnum
CREATE TYPE "GradingCompany" AS ENUM ('PSA', 'BGS', 'CGC');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('TRADING_CARD', 'SPORTS_CARD', 'AMULET', 'COMIC');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('READY_TO_SHIP', 'IN_VAULT', 'IN_ESCROW', 'DELISTED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NONE', 'AWAITING_SELLER_SHIPMENT', 'IN_TRANSIT_TO_WAREHOUSE', 'IN_INSPECTION', 'REJECTED', 'IN_TRANSIT_TO_BUYER', 'DELIVERED');

-- CreateEnum
CREATE TYPE "FulfillmentChoice" AS ENUM ('SHIP', 'VAULT');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('LOCKED', 'RELEASED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('PENDING_INSPECTION', 'APPROVED_SHIP', 'APPROVED_VAULT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProvenanceType" AS ENUM ('MINTED_DIGITAL_TWIN', 'LISTED', 'DELISTED', 'ESCROW_LOCKED', 'SHIPPED_TO_WAREHOUSE', 'INSPECTION_PASSED', 'INSPECTION_REJECTED', 'DEPOSITED_TO_VAULT', 'DELIVERED_TO_BUYER', 'OWNERSHIP_TRANSFERRED', 'RELISTED', 'REDEEMED', 'ESCROW_REFUNDED');

-- CreateEnum
CREATE TYPE "VerificationPackage" AS ENUM ('SELF_MINT', 'FULL_SERVICE');

-- CreateEnum
CREATE TYPE "GradingSubmissionStatus" AS ENUM ('AWAITING_SHIPMENT_TO_GRADER', 'AT_GRADING_COMPANY', 'GRADED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handle" TEXT,
    "walletMock" TEXT,
    "shippingAddress" TEXT,
    "phone" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "gradingCompany" "GradingCompany" NOT NULL,
    "grade" DOUBLE PRECISION NOT NULL,
    "serial" TEXT NOT NULL,
    "themeIndex" INTEGER NOT NULL DEFAULT 0,
    "priceThb" INTEGER,
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "vaulted" BOOLEAN NOT NULL DEFAULT false,
    "marketStatus" "MarketStatus" NOT NULL DEFAULT 'READY_TO_SHIP',
    "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'NONE',
    "mockMintTx" TEXT NOT NULL,
    "verificationPackage" "VerificationPackage" NOT NULL DEFAULT 'SELF_MINT',
    "mintFeeThb" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationPhoto" (
    "id" TEXT NOT NULL,
    "viewKey" TEXT NOT NULL,
    "viewLabel" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "VerificationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingSubmission" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemSubtitle" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "gradingCompany" "GradingCompany" NOT NULL,
    "packagePriceThb" INTEGER NOT NULL,
    "status" "GradingSubmissionStatus" NOT NULL DEFAULT 'AWAITING_SHIPMENT_TO_GRADER',
    "mockPaymentTx" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "sellerId" TEXT NOT NULL,
    "resultAssetId" TEXT,

    CONSTRAINT "GradingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvenanceEvent" (
    "id" TEXT NOT NULL,
    "type" "ProvenanceType" NOT NULL,
    "note" TEXT NOT NULL,
    "mockTxSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "ProvenanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "amountThb" INTEGER NOT NULL,
    "fulfillmentChoice" "FulfillmentChoice" NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'LOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "assetId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundPackage" (
    "id" TEXT NOT NULL,
    "declaredSerial" TEXT NOT NULL,
    "declaredGradingCompany" "GradingCompany" NOT NULL,
    "declaredGrade" DOUBLE PRECISION NOT NULL,
    "officialSerial" TEXT NOT NULL,
    "officialGradingCompany" "GradingCompany" NOT NULL,
    "officialGrade" DOUBLE PRECISION NOT NULL,
    "officialName" TEXT NOT NULL,
    "status" "InboundStatus" NOT NULL DEFAULT 'PENDING_INSPECTION',
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "assetId" TEXT NOT NULL,
    "escrowTxId" TEXT NOT NULL,

    CONSTRAINT "InboundPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serial_key" ON "Asset"("serial");

-- CreateIndex
CREATE INDEX "Asset_sellerId_idx" ON "Asset"("sellerId");

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- CreateIndex
CREATE INDEX "VerificationPhoto_assetId_idx" ON "VerificationPhoto"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingSubmission_resultAssetId_key" ON "GradingSubmission"("resultAssetId");

-- CreateIndex
CREATE INDEX "GradingSubmission_sellerId_idx" ON "GradingSubmission"("sellerId");

-- CreateIndex
CREATE INDEX "ProvenanceEvent_assetId_idx" ON "ProvenanceEvent"("assetId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_assetId_idx" ON "EscrowTransaction"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundPackage_escrowTxId_key" ON "InboundPackage"("escrowTxId");

-- CreateIndex
CREATE INDEX "InboundPackage_assetId_idx" ON "InboundPackage"("assetId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationPhoto" ADD CONSTRAINT "VerificationPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingSubmission" ADD CONSTRAINT "GradingSubmission_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingSubmission" ADD CONSTRAINT "GradingSubmission_resultAssetId_fkey" FOREIGN KEY ("resultAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvenanceEvent" ADD CONSTRAINT "ProvenanceEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvenanceEvent" ADD CONSTRAINT "ProvenanceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundPackage" ADD CONSTRAINT "InboundPackage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundPackage" ADD CONSTRAINT "InboundPackage_escrowTxId_fkey" FOREIGN KEY ("escrowTxId") REFERENCES "EscrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
