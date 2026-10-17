-- CreateEnum
CREATE TYPE "LeaderboardCategory" AS ENUM ('WHALE', 'ALPHA', 'CONSISTENCY', 'MARKET_MAKER', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "AntiCheatRule" AS ENUM ('SELF_TRADE', 'LINKED_WALLET', 'ROUND_TRIP', 'SHORT_HOLD', 'OUTLIER_PRICE');

-- CreateEnum
CREATE TYPE "AntiCheatAction" AS ENUM ('EXCLUDED', 'REVIEW');

-- CreateTable
CREATE TABLE "UserTradeStats" (
    "id" TEXT NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "qualifyingTrades" INTEGER NOT NULL,
    "winningTrades" INTEGER NOT NULL,
    "realizedProfitThb" INTEGER NOT NULL,
    "costBasisThb" INTEGER NOT NULL,
    "roiPct" DOUBLE PRECISION,
    "bestTradeRoiPct" DOUBLE PRECISION,
    "winRatePct" DOUBLE PRECISION,
    "greenDayStreak" INTEGER NOT NULL,
    "volumeThb" INTEGER NOT NULL,
    "filledOrders" INTEGER NOT NULL,
    "distinctCounterparties" INTEGER NOT NULL,
    "excludedTrades" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserTradeStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "category" "LeaderboardCategory" NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'ALL',
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiCheatLog" (
    "id" TEXT NOT NULL,
    "rule" "AntiCheatRule" NOT NULL,
    "action" "AntiCheatAction" NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "escrowTransactionId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,

    CONSTRAINT "AntiCheatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardBadge" (
    "id" TEXT NOT NULL,
    "category" "LeaderboardCategory" NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'ALL',
    "tier" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LeaderboardBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTradeStats_period_periodStart_idx" ON "UserTradeStats"("period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UserTradeStats_userId_period_periodStart_key" ON "UserTradeStats"("userId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_category_period_periodStart_segment_ran_idx" ON "LeaderboardSnapshot"("category", "period", "periodStart", "segment", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_category_period_periodStart_segment_use_key" ON "LeaderboardSnapshot"("category", "period", "periodStart", "segment", "userId");

-- CreateIndex
CREATE INDEX "AntiCheatLog_sellerId_idx" ON "AntiCheatLog"("sellerId");

-- CreateIndex
CREATE INDEX "AntiCheatLog_action_cleared_idx" ON "AntiCheatLog"("action", "cleared");

-- CreateIndex
CREATE UNIQUE INDEX "AntiCheatLog_escrowTransactionId_rule_key" ON "AntiCheatLog"("escrowTransactionId", "rule");

-- CreateIndex
CREATE INDEX "LeaderboardBadge_userId_idx" ON "LeaderboardBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardBadge_userId_category_period_periodStart_segment_key" ON "LeaderboardBadge"("userId", "category", "period", "periodStart", "segment");

-- AddForeignKey
ALTER TABLE "UserTradeStats" ADD CONSTRAINT "UserTradeStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntiCheatLog" ADD CONSTRAINT "AntiCheatLog_escrowTransactionId_fkey" FOREIGN KEY ("escrowTransactionId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardBadge" ADD CONSTRAINT "LeaderboardBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

