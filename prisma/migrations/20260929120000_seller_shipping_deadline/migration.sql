-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InboundStatus" ADD VALUE 'AWAITING_SELLER_SHIPMENT';
ALTER TYPE "InboundStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SELLER_SHIP_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_SHIPPED';
ALTER TYPE "NotificationType" ADD VALUE 'SALE_CANCELLED';

-- AlterTable
ALTER TABLE "InboundPackage" ADD COLUMN     "sellerCarrier" TEXT,
ADD COLUMN     "sellerShippedAt" TIMESTAMP(3),
ADD COLUMN     "sellerTrackingNumber" TEXT,
ADD COLUMN     "shipByDeadline" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InboundPackage_status_shipByDeadline_idx" ON "InboundPackage"("status", "shipByDeadline");

