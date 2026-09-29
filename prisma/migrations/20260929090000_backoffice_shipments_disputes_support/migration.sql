-- CreateEnum
CREATE TYPE "ShipmentReason" AS ENUM ('SALE', 'REDEEM');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('AWAITING_DISPATCH', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DAMAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED_REFUNDED', 'RESOLVED_NO_ACTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SHIPMENT_DISPATCHED';
ALTER TYPE "NotificationType" ADD VALUE 'SHIPMENT_DELIVERED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_OPENED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTACT_MESSAGE';

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "handledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "reason" "ShipmentReason" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'AWAITING_DISPATCH',
    "shippingAddress" TEXT NOT NULL,
    "phone" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "assetId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "escrowTxId" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "escrowTxId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_escrowTxId_key" ON "Shipment"("escrowTxId");

-- CreateIndex
CREATE INDEX "Shipment_status_createdAt_idx" ON "Shipment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_assetId_idx" ON "Shipment"("assetId");

-- CreateIndex
CREATE INDEX "Shipment_recipientId_idx" ON "Shipment"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_escrowTxId_key" ON "Dispute"("escrowTxId");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_handledAt_createdAt_idx" ON "ContactMessage"("handledAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_escrowTxId_fkey" FOREIGN KEY ("escrowTxId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_escrowTxId_fkey" FOREIGN KEY ("escrowTxId") REFERENCES "EscrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

