-- CreateTable
CREATE TABLE "StockMediaSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerAssetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "localAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockMediaSelection_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMediaSelection_localAssetId_fkey" FOREIGN KEY ("localAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Existing Unsplash backgrounds continue to render from Scene.layoutJson or
-- Scene.visual. This additive snapshot preserves their exact hotlink, including
-- ixid, without guessing unavailable photographer or asset identifiers.
WITH "LegacyUnsplash" AS (
    SELECT
        "Scene"."id" AS "sceneId",
        "Script"."width" AS "width",
        "Script"."height" AS "height",
        CASE
            WHEN json_valid("Scene"."layoutJson")
              AND json_type("Scene"."layoutJson", '$.background.url') = 'text'
              THEN json_extract("Scene"."layoutJson", '$.background.url')
            WHEN json_valid("Scene"."visual")
              AND json_type("Scene"."visual", '$.url') = 'text'
              THEN json_extract("Scene"."visual", '$.url')
            ELSE NULL
        END AS "mediaUrl"
    FROM "Scene"
    INNER JOIN "Script" ON "Script"."id" = "Scene"."scriptId"
), "MigratedUnsplash" AS (
    SELECT *, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS "capturedAt"
    FROM "LegacyUnsplash"
    WHERE "mediaUrl" LIKE 'https://images.unsplash.com/%'
       OR "mediaUrl" LIKE 'https://plus.unsplash.com/%'
)
INSERT INTO "StockMediaSelection" (
    "id", "sceneId", "providerId", "providerAssetId", "kind",
    "snapshotJson", "localAssetId", "createdAt", "updatedAt"
)
SELECT
    'legacy-unsplash-' || "sceneId",
    "sceneId",
    'unsplash',
    'legacy:' || "sceneId",
    'image',
    json_object(
        'schemaVersion', 1,
        'resolvedAt', "capturedAt",
        'compliantRemoteUrl', "mediaUrl",
        'providerSnapshot', json_object(
            'providerId', 'unsplash',
            'providerAssetId', 'legacy:' || "sceneId",
            'kind', 'image',
            'previewUrl', "mediaUrl",
            'sourcePageUrl', 'https://unsplash.com',
            'creator', 'Unsplash',
            'creatorUrl', 'https://unsplash.com',
            'width', "width",
            'height', "height",
            'orientation', CASE
                WHEN "width" = "height" THEN 'square'
                WHEN "width" > "height" THEN 'landscape'
                ELSE 'portrait'
            END,
            'renderRenditions', json_array(json_object(
                'id', 'legacy-hotlink',
                'url', "mediaUrl",
                'width', "width",
                'height', "height"
            )),
            'attribution', json_object(
                'text', 'Photo from Unsplash',
                'required', json('true')
            ),
            'acquisitionPolicy', 'hotlink'
        ),
        'sourceRevision', json_object(
            'capturedAt', "capturedAt",
            'termsUrl', 'https://unsplash.com/terms'
        ),
        'selectedRendition', json_object(
            'id', 'legacy-hotlink',
            'url', "mediaUrl",
            'width', "width",
            'height', "height"
        ),
        'usageEvent', json_object('state', 'pending')
    ),
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "MigratedUnsplash";

-- CreateIndex
CREATE UNIQUE INDEX "StockMediaSelection_sceneId_key" ON "StockMediaSelection"("sceneId");

-- CreateIndex
CREATE INDEX "StockMediaSelection_providerId_providerAssetId_idx" ON "StockMediaSelection"("providerId", "providerAssetId");

-- CreateIndex
CREATE INDEX "StockMediaSelection_localAssetId_idx" ON "StockMediaSelection"("localAssetId");
