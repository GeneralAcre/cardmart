-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "walletMock" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Asset" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sellerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Asset_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProvenanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "mockTxSignature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,
    "actorId" TEXT,
    CONSTRAINT "ProvenanceEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProvenanceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amountThb" INTEGER NOT NULL,
    "fulfillmentChoice" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" DATETIME,
    "assetId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    CONSTRAINT "EscrowTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EscrowTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EscrowTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboundPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "declaredSerial" TEXT NOT NULL,
    "declaredGradingCompany" TEXT NOT NULL,
    "declaredGrade" REAL NOT NULL,
    "officialSerial" TEXT NOT NULL,
    "officialGradingCompany" TEXT NOT NULL,
    "officialGrade" REAL NOT NULL,
    "officialName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_INSPECTION',
    "arrivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "assetId" TEXT NOT NULL,
    "escrowTxId" TEXT NOT NULL,
    CONSTRAINT "InboundPackage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InboundPackage_escrowTxId_fkey" FOREIGN KEY ("escrowTxId") REFERENCES "EscrowTransaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serial_key" ON "Asset"("serial");

-- CreateIndex
CREATE INDEX "Asset_sellerId_idx" ON "Asset"("sellerId");

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- CreateIndex
CREATE INDEX "ProvenanceEvent_assetId_idx" ON "ProvenanceEvent"("assetId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_assetId_idx" ON "EscrowTransaction"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundPackage_escrowTxId_key" ON "InboundPackage"("escrowTxId");

-- CreateIndex
CREATE INDEX "InboundPackage_assetId_idx" ON "InboundPackage"("assetId");
