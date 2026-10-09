-- CreateTable
CREATE TABLE "MarketPriceSnapshot" (
    "id" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "tierKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "medianUsd" DOUBLE PRECISION NOT NULL,
    "lowUsd" DOUBLE PRECISION NOT NULL,
    "highUsd" DOUBLE PRECISION NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceSnapshot_cardKey_tierKey_day_key" ON "MarketPriceSnapshot"("cardKey", "tierKey", "day");
