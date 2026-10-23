CREATE TABLE "AudioEditSession" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "kind" TEXT NOT NULL,
 "takeId" TEXT NOT NULL,
 "historyJson" TEXT NOT NULL,
 "cursor" INTEGER NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "planHash" TEXT NOT NULL,
 "derivedTakeId" TEXT,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AudioEditSession_kind_takeId_key" ON "AudioEditSession"("kind","takeId");
