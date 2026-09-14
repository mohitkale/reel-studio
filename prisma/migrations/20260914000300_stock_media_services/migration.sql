-- CreateTable
CREATE TABLE "StockMediaResponseCache" (
    "requestHash" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestJson" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockMediaQuotaState" (
    "providerId" TEXT NOT NULL PRIMARY KEY,
    "limit" INTEGER,
    "remaining" INTEGER,
    "resetAt" DATETIME,
    "observedAt" DATETIME NOT NULL,
    "metadataJson" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockMediaMaterialization" (
    "requestHash" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "providerAssetId" TEXT NOT NULL,
    "renditionId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockMediaMaterialization_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockMediaResponseCache_providerId_operation_idx" ON "StockMediaResponseCache"("providerId", "operation");

-- CreateIndex
CREATE INDEX "StockMediaResponseCache_expiresAt_idx" ON "StockMediaResponseCache"("expiresAt");

-- CreateIndex
CREATE INDEX "StockMediaMaterialization_providerId_providerAssetId_idx" ON "StockMediaMaterialization"("providerId", "providerAssetId");

-- CreateIndex
CREATE INDEX "StockMediaMaterialization_assetId_idx" ON "StockMediaMaterialization"("assetId");
