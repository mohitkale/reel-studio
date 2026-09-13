CREATE TABLE "ProductionJob" (
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
  "finishedAt" DATETIME
);
CREATE UNIQUE INDEX "ProductionJob_idempotencyKey_key" ON "ProductionJob"("idempotencyKey");
CREATE INDEX "ProductionJob_state_priority_createdAt_idx" ON "ProductionJob"("state", "priority", "createdAt");
CREATE INDEX "ProductionJob_leaseExpiresAt_idx" ON "ProductionJob"("leaseExpiresAt");

CREATE TABLE "ProductionJobStep" (
  "id" TEXT NOT NULL PRIMARY KEY, "jobId" TEXT NOT NULL, "key" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'queued', "progress" REAL NOT NULL DEFAULT 0,
  "cacheKey" TEXT, "detailJson" TEXT, "error" TEXT, "startedAt" DATETIME,
  "finishedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductionJobStep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductionJobStep_jobId_key_key" ON "ProductionJobStep"("jobId", "key");
CREATE INDEX "ProductionJobStep_jobId_state_idx" ON "ProductionJobStep"("jobId", "state");
CREATE INDEX "ProductionJobStep_cacheKey_idx" ON "ProductionJobStep"("cacheKey");

CREATE TABLE "ProductionJobEvent" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "jobId" TEXT NOT NULL,
  "type" TEXT NOT NULL, "dataJson" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductionJobEvent_jobId_id_idx" ON "ProductionJobEvent"("jobId", "id");

CREATE TABLE "ProductionJobOutput" (
  "id" TEXT NOT NULL PRIMARY KEY, "jobId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "format" TEXT NOT NULL, "path" TEXT NOT NULL, "checksum" TEXT,
  "metadataJson" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionJobOutput_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductionJobOutput_jobId_idx" ON "ProductionJobOutput"("jobId");
