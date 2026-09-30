-- Existing and imported caption tracks retain unknown timing provenance.
ALTER TABLE "CaptionTrack" ADD COLUMN "sourceTakeId" TEXT;
ALTER TABLE "CaptionTrack" ADD COLUMN "sourceFps" INTEGER;
