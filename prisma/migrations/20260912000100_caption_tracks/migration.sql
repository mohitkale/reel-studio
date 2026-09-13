CREATE TABLE "CaptionTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Subtitles',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timingSource" TEXT NOT NULL DEFAULT 'estimated',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaptionTrack_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CaptionCue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startFrame" INTEGER NOT NULL,
    "endFrame" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "wordsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaptionCue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CaptionTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CaptionTrack_scriptId_updatedAt_idx" ON "CaptionTrack"("scriptId", "updatedAt");
CREATE INDEX "CaptionCue_trackId_order_idx" ON "CaptionCue"("trackId", "order");
