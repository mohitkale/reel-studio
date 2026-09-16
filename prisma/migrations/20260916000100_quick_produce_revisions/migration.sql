CREATE TABLE "ProductionRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "revisionHash" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'quick_produce',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductionRevision_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductionRevision_projectId_createdAt_idx" ON "ProductionRevision"("projectId", "createdAt");
CREATE INDEX "ProductionRevision_scriptId_createdAt_idx" ON "ProductionRevision"("scriptId", "createdAt");
CREATE INDEX "ProductionRevision_revisionHash_idx" ON "ProductionRevision"("revisionHash");

ALTER TABLE "ProductionJob" ADD COLUMN "productionRevisionId" TEXT REFERENCES "ProductionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProductionJob_productionRevisionId_key" ON "ProductionJob"("productionRevisionId");
