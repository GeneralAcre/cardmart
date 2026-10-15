-- CreateTable
CREATE TABLE "PurchaseCost" (
    "id" TEXT NOT NULL,
    "costThb" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "PurchaseCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCost_userId_assetId_key" ON "PurchaseCost"("userId", "assetId");

-- AddForeignKey
ALTER TABLE "PurchaseCost" ADD CONSTRAINT "PurchaseCost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCost" ADD CONSTRAINT "PurchaseCost_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

