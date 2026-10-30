CREATE TABLE "MediaRankingJob" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "idempotencyKey" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "scriptId" TEXT NOT NULL,
 "sceneId" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'queued',
 "sourceHash" TEXT NOT NULL,
 "requestJson" TEXT NOT NULL,
 "candidatesJson" TEXT,
 "assessmentsJson" TEXT,
 "callsUsed" INTEGER NOT NULL DEFAULT 0,
 "deadlineAt" DATETIME NOT NULL,
 "error" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "MediaRankingJob_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MediaRankingJob_idempotencyKey_key" ON "MediaRankingJob"("idempotencyKey");
CREATE INDEX "MediaRankingJob_scriptId_createdAt_idx" ON "MediaRankingJob"("scriptId","createdAt");
