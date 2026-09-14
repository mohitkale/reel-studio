ALTER TABLE "Podcast" ADD COLUMN "introMusicAssetId" TEXT;
ALTER TABLE "Podcast" ADD COLUMN "outroMusicAssetId" TEXT;
ALTER TABLE "Podcast" ADD COLUMN "pronunciationsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PodcastTurn" ADD COLUMN "pauseAfterSeconds" REAL;
ALTER TABLE "PodcastTake" ADD COLUMN "finishingJson" TEXT NOT NULL DEFAULT '{}';
