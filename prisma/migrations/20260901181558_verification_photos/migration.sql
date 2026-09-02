-- CreateTable
CREATE TABLE "VerificationPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "viewKey" TEXT NOT NULL,
    "viewLabel" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "VerificationPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VerificationPhoto_assetId_idx" ON "VerificationPhoto"("assetId");
