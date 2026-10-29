CREATE TABLE "EvidenceRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cacheKey" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "packJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "EvidenceRevision_cacheKey_revision_key" ON "EvidenceRevision"("cacheKey", "revision");
CREATE INDEX "EvidenceRevision_cacheKey_expiresAt_idx" ON "EvidenceRevision"("cacheKey", "expiresAt");

CREATE TABLE "ResearchJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cacheKey" TEXT NOT NULL,
  "activeKey" TEXT,
  "requestJson" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'queued',
  "usageJson" TEXT NOT NULL,
  "error" TEXT,
  "deadlineAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "evidenceId" TEXT,
  CONSTRAINT "ResearchJob_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ResearchJob_activeKey_key" ON "ResearchJob"("activeKey");
CREATE INDEX "ResearchJob_state_deadlineAt_idx" ON "ResearchJob"("state", "deadlineAt");

CREATE TABLE "ResearchSubmission" (
  "idempotencyKey" TEXT NOT NULL PRIMARY KEY,
  "fingerprint" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  CONSTRAINT "ResearchSubmission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ResearchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
