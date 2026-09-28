-- CreateEnum
CREATE TYPE "BidLockStatus" AS ENUM ('HELD', 'REFUNDED', 'CONVERTED');

-- AlterEnum
ALTER TYPE "AuctionStatus" ADD VALUE 'ENDED_UNCLAIMED';

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "claimDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "lamportsLocked" BIGINT,
ADD COLUMN     "lockStatus" "BidLockStatus",
ADD COLUMN     "lockTxSignature" TEXT,
ADD COLUMN     "onChain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onChainTradeId" BIGINT,
ADD COLUMN     "tradeAccount" TEXT;

-- AlterTable
ALTER TABLE "GradingSubmission" ADD COLUMN     "game" "CardGame" NOT NULL DEFAULT 'POKEMON';

