-- CreateTable
CREATE TABLE "GradingSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemName" TEXT NOT NULL,
    "itemSubtitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gradingCompany" TEXT NOT NULL,
    "packagePriceThb" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_SHIPMENT_TO_GRADER',
    "mockPaymentTx" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "sellerId" TEXT NOT NULL,
    "resultAssetId" TEXT,
    CONSTRAINT "GradingSubmission_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradingSubmission_resultAssetId_fkey" FOREIGN KEY ("resultAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gradingCompany" TEXT NOT NULL,
    "grade" REAL NOT NULL,
    "serial" TEXT NOT NULL,
    "themeIndex" INTEGER NOT NULL DEFAULT 0,
    "priceThb" INTEGER,
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "vaulted" BOOLEAN NOT NULL DEFAULT false,
    "marketStatus" TEXT NOT NULL DEFAULT 'READY_TO_SHIP',
    "pipelineStage" TEXT NOT NULL DEFAULT 'NONE',
    "mockMintTx" TEXT NOT NULL,
    "verificationPackage" TEXT NOT NULL DEFAULT 'SELF_MINT',
    "mintFeeThb" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sellerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Asset_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("category", "createdAt", "forSale", "grade", "gradingCompany", "id", "marketStatus", "mockMintTx", "name", "ownerId", "pipelineStage", "priceThb", "sellerId", "serial", "subtitle", "themeIndex", "updatedAt", "vaulted") SELECT "category", "createdAt", "forSale", "grade", "gradingCompany", "id", "marketStatus", "mockMintTx", "name", "ownerId", "pipelineStage", "priceThb", "sellerId", "serial", "subtitle", "themeIndex", "updatedAt", "vaulted" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_serial_key" ON "Asset"("serial");
CREATE INDEX "Asset_sellerId_idx" ON "Asset"("sellerId");
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GradingSubmission_resultAssetId_key" ON "GradingSubmission"("resultAssetId");

-- CreateIndex
CREATE INDEX "GradingSubmission_sellerId_idx" ON "GradingSubmission"("sellerId");
