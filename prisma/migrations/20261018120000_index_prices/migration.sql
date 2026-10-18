-- CreateTable
CREATE TABLE "IndexPrice" (
    "id" TEXT NOT NULL,
    "game" "CardGame" NOT NULL,
    "day" DATE NOT NULL,
    "productId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "IndexPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndexPrice_game_day_rank_idx" ON "IndexPrice"("game", "day", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "IndexPrice_game_day_productId_key" ON "IndexPrice"("game", "day", "productId");

