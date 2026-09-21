-- CreateIndex
CREATE INDEX "Asset_marketStatus_createdAt_idx" ON "Asset"("marketStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_forSale_marketStatus_idx" ON "Asset"("forSale", "marketStatus");

-- CreateIndex
CREATE INDEX "EscrowTransaction_sellerId_status_idx" ON "EscrowTransaction"("sellerId", "status");
