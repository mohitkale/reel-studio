CREATE TABLE "StudioPreset" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "name" TEXT NOT NULL,
 "documentJson" TEXT NOT NULL,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "StudioPreset_name_key" ON "StudioPreset"("name");
