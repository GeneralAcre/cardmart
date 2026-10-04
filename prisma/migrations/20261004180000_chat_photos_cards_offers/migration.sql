-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "offerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_offerId_key" ON "Message"("offerId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

