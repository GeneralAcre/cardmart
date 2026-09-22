-- DropIndex
DROP INDEX "Auction_assetId_key";

-- CreateIndex
CREATE INDEX "Auction_assetId_idx" ON "Auction"("assetId");
