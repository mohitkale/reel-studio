ALTER TABLE "Project" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "series" TEXT NOT NULL DEFAULT '';
CREATE TABLE "SceneEdit" (
 "sequence" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "scriptId" TEXT NOT NULL,
 "sceneId" TEXT NOT NULL,
 "beforeJson" TEXT NOT NULL,
 "afterJson" TEXT NOT NULL,
 "undone" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SceneEdit_scriptId_sequence_idx" ON "SceneEdit"("scriptId", "sequence");
