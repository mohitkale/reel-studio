ALTER TABLE "Podcast" ADD COLUMN "presetId" TEXT NOT NULL DEFAULT 'two-host-discussion';
ALTER TABLE "PodcastTake" ADD COLUMN "chaptersJson" TEXT NOT NULL DEFAULT '[]';
