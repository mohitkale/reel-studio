ALTER TABLE "PodcastTake" ADD COLUMN "mp3Path" TEXT;

CREATE TABLE "PodcastTurnAudioBeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "podcastId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL DEFAULT '',
    "textHash" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PodcastTurnAudioBeat_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "PodcastTurn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PodcastTurnAudioBeat_turnId_providerId_voiceId_modelId_textHash_key"
ON "PodcastTurnAudioBeat"("turnId", "providerId", "voiceId", "modelId", "textHash");

CREATE INDEX "PodcastTurnAudioBeat_podcastId_idx"
ON "PodcastTurnAudioBeat"("podcastId");
