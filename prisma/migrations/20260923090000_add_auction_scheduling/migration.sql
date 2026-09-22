-- Add auction scheduling. Existing auctions start immediately, preserving
-- their current behavior and keeping the migration safe for populated data.
ALTER TABLE "Auction" ADD COLUMN "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Auction_status_startTime_idx" ON "Auction"("status", "startTime");

ALTER TYPE "NotificationType" ADD VALUE 'AUCTION_STARTING';
