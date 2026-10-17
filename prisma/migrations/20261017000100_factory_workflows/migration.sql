CREATE TABLE "FactoryProfile" (
 "id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "name" TEXT NOT NULL, "documentJson" TEXT NOT NULL, "digest" TEXT NOT NULL,
 "archived" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FactoryProfile_key_version_key" ON "FactoryProfile"("key", "version");
CREATE TABLE "FactoryRun" (
 "id" TEXT NOT NULL PRIMARY KEY, "idempotencyKey" TEXT NOT NULL, "sourceRevisionId" TEXT NOT NULL,
 "requestJson" TEXT NOT NULL, "packDigest" TEXT NOT NULL, "batchId" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FactoryRun_idempotencyKey_key" ON "FactoryRun"("idempotencyKey");
CREATE UNIQUE INDEX "FactoryRun_batchId_key" ON "FactoryRun"("batchId");
CREATE TABLE "FactoryVariant" (
 "id" TEXT NOT NULL PRIMARY KEY, "runId" TEXT NOT NULL, "key" TEXT NOT NULL,
 "revisionId" TEXT NOT NULL, "lineageJson" TEXT NOT NULL,
 CONSTRAINT "FactoryVariant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FactoryVariant_revisionId_key" ON "FactoryVariant"("revisionId");
CREATE UNIQUE INDEX "FactoryVariant_runId_key_key" ON "FactoryVariant"("runId", "key");
CREATE TABLE "FactoryPack" (
 "digest" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "version" TEXT NOT NULL,
 "manifestJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FactoryPack_key_version_key" ON "FactoryPack"("key", "version");
