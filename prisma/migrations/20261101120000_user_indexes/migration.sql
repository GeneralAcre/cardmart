-- Extra indexes a user builds on the Market page, beside their watchlist one.

-- CreateTable
CREATE TABLE "UserIndex" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIndexCard" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "UserIndexCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserIndex_userId_idx" ON "UserIndex"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIndexCard_indexId_assetId_key" ON "UserIndexCard"("indexId", "assetId");

-- AddForeignKey
ALTER TABLE "UserIndex" ADD CONSTRAINT "UserIndex_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIndexCard" ADD CONSTRAINT "UserIndexCard_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "UserIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIndexCard" ADD CONSTRAINT "UserIndexCard_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
