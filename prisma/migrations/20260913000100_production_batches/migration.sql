ALTER TABLE "ProductionJob" ADD COLUMN "batchItemId" TEXT;
CREATE UNIQUE INDEX "ProductionJob_batchItemId_key" ON "ProductionJob"("batchItemId");

CREATE TABLE "ProductionBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "requestSnapshot" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ProductionBatch_idempotencyKey_key" ON "ProductionBatch"("idempotencyKey");
CREATE INDEX "ProductionBatch_createdAt_idx" ON "ProductionBatch"("createdAt");

CREATE TABLE "ProductionBatchItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "variantIndex" INTEGER NOT NULL,
  "label" TEXT,
  "orientation" TEXT,
  "requestSnapshot" TEXT NOT NULL,
  "validationError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductionBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductionBatchItem_batchId_rowIndex_variantIndex_key" ON "ProductionBatchItem"("batchId", "rowIndex", "variantIndex");
CREATE INDEX "ProductionBatchItem_batchId_rowIndex_idx" ON "ProductionBatchItem"("batchId", "rowIndex");

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductionJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'queued',
  "inputSnapshot" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "leaseOwner" TEXT,
  "leaseExpiresAt" DATETIME,
  "heartbeatAt" DATETIME,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "startedAt" DATETIME,
  "finishedAt" DATETIME,
  "batchItemId" TEXT,
  CONSTRAINT "ProductionJob_batchItemId_fkey" FOREIGN KEY ("batchItemId") REFERENCES "ProductionBatchItem"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionJob" ("attempt", "cancelRequested", "createdAt", "error", "finishedAt", "heartbeatAt", "id", "idempotencyKey", "inputSnapshot", "kind", "leaseExpiresAt", "leaseOwner", "priority", "startedAt", "state", "updatedAt", "batchItemId") SELECT "attempt", "cancelRequested", "createdAt", "error", "finishedAt", "heartbeatAt", "id", "idempotencyKey", "inputSnapshot", "kind", "leaseExpiresAt", "leaseOwner", "priority", "startedAt", "state", "updatedAt", "batchItemId" FROM "ProductionJob";
DROP TABLE "ProductionJob";
ALTER TABLE "new_ProductionJob" RENAME TO "ProductionJob";
CREATE UNIQUE INDEX "ProductionJob_idempotencyKey_key" ON "ProductionJob"("idempotencyKey");
CREATE UNIQUE INDEX "ProductionJob_batchItemId_key" ON "ProductionJob"("batchItemId");
CREATE INDEX "ProductionJob_state_priority_createdAt_idx" ON "ProductionJob"("state", "priority", "createdAt");
CREATE INDEX "ProductionJob_leaseExpiresAt_idx" ON "ProductionJob"("leaseExpiresAt");
PRAGMA foreign_keys=ON;
