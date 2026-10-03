-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "videoEngine" TEXT NOT NULL DEFAULT 'hyperframes',
    "brandKitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "palette" TEXT,
    "fonts" TEXT,
    "logoAssetId" TEXT,
    "handle" TEXT,
    "ctaDefaults" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1920,
    "brandOverrides" TEXT,
    "coverUrl" TEXT,
    "musicUrl" TEXT,
    "musicVolume" INTEGER NOT NULL DEFAULT 20,
    "sfxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sfxJson" TEXT,
    "hideText" BOOLEAN NOT NULL DEFAULT false,
    "hideProgressBar" BOOLEAN NOT NULL DEFAULT false,
    "voiceMode" TEXT NOT NULL DEFAULT 'oneshot',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL DEFAULT 'placeholder',
    "text" TEXT NOT NULL,
    "spokenText" TEXT,
    "emphasis" TEXT,
    "visual" TEXT,
    "layoutJson" TEXT,
    "assetRefs" TEXT,
    "hideText" BOOLEAN,
    "selectedVoiceClipId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_selectedVoiceClipId_fkey" FOREIGN KEY ("selectedVoiceClipId") REFERENCES "SceneVoiceClip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceTake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "label" TEXT,
    "providerId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "totalFrames" INTEGER NOT NULL,
    "timingJson" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'oneshot',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceTake_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SceneVoiceClip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "durationFrames" INTEGER NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "label" TEXT,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SceneVoiceClip_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SceneVoiceClip_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "voiceTakeId" TEXT,
    "templateSetId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "quality" TEXT,
    "progress" REAL NOT NULL DEFAULT 0,
    "outputPath" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Render_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SceneAudioBeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL DEFAULT '',
    "textHash" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "path" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProviderSetting" (
    "providerId" TEXT NOT NULL PRIMARY KEY,
    "hasKey" BOOLEAN NOT NULL DEFAULT false,
    "defaultModel" TEXT
);

-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "length" TEXT NOT NULL DEFAULT 'short',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PodcastCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "podcastId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'neutral',
    "definition" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT NOT NULL DEFAULT '',
    "voiceId" TEXT NOT NULL DEFAULT '',
    "modelId" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PodcastCharacter_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PodcastTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "podcastId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PodcastTurn_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PodcastTurn_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "PodcastCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PodcastTake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "podcastId" TEXT NOT NULL,
    "label" TEXT,
    "providerId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "totalFrames" INTEGER NOT NULL,
    "timingJson" TEXT NOT NULL,
    "voicesJson" TEXT NOT NULL DEFAULT '[]',
    "audioPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PodcastTake_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Script_projectId_idx" ON "Script"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_selectedVoiceClipId_key" ON "Scene"("selectedVoiceClipId");

-- CreateIndex
CREATE INDEX "Scene_scriptId_order_idx" ON "Scene"("scriptId", "order");

-- CreateIndex
CREATE INDEX "VoiceTake_scriptId_idx" ON "VoiceTake"("scriptId");

-- CreateIndex
CREATE INDEX "SceneVoiceClip_scriptId_idx" ON "SceneVoiceClip"("scriptId");

-- CreateIndex
CREATE INDEX "SceneVoiceClip_sceneId_createdAt_idx" ON "SceneVoiceClip"("sceneId", "createdAt");

-- CreateIndex
CREATE INDEX "Render_scriptId_idx" ON "Render"("scriptId");

-- CreateIndex
CREATE INDEX "SceneAudioBeat_scriptId_idx" ON "SceneAudioBeat"("scriptId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneAudioBeat_sceneId_providerId_voiceId_modelId_textHash_key" ON "SceneAudioBeat"("sceneId", "providerId", "voiceId", "modelId", "textHash");

-- CreateIndex
CREATE INDEX "PodcastCharacter_podcastId_order_idx" ON "PodcastCharacter"("podcastId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastCharacter_podcastId_key_key" ON "PodcastCharacter"("podcastId", "key");

-- CreateIndex
CREATE INDEX "PodcastTurn_podcastId_order_idx" ON "PodcastTurn"("podcastId", "order");

-- CreateIndex
CREATE INDEX "PodcastTake_podcastId_idx" ON "PodcastTake"("podcastId");
