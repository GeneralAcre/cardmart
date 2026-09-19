-- AlterTable
ALTER TABLE "EscrowTransaction"
  ADD COLUMN "onChain" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onChainTradeId" BIGINT,
  ADD COLUMN "tradeAccount" TEXT,
  ADD COLUMN "lamportsLocked" BIGINT;
