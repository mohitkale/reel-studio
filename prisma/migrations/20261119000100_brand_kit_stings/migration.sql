-- A brand kit can name an uploaded audio asset to play at the start and at the end of its videos.
ALTER TABLE "BrandKit" ADD COLUMN "introStingAssetId" TEXT;
ALTER TABLE "BrandKit" ADD COLUMN "outroStingAssetId" TEXT;
