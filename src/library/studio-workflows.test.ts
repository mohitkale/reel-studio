// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), deleted: vi.fn() }));
vi.mock("@/providers/ai/registry", () => ({
  getAIProvider: () => ({
    isConfigured: () => true,
    generatePlan: mocks.generate,
  }),
}));
vi.mock("@/library/storage", () => ({
  getAssetStore: () => ({
    url: (key: string) => `/media/${key}`,
    delete: mocks.deleted,
  }),
}));
const previous = process.env.DATABASE_URL;
afterEach(async () => {
  const state = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await state.prisma?.$disconnect();
  delete state.prisma;
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  vi.resetModules();
  vi.clearAllMocks();
});
it("preserves manual language versions, protects frozen assets and shares reviewed recording audio safely", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "studio-workflows-"));
  const filename = path.join(directory, "test.db"),
    db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations").sort())
    if (migration.startsWith("20"))
      db.exec(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
  db.close();
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  try {
    const project = await prisma.project.create({
      data: { name: "Source", series: "Weekly" },
    });
    const script = await prisma.script.create({
      data: {
        projectId: project.id,
        name: "Source",
        musicUrl: "/media/bed.wav",
        musicVolume: 44,
        hideText: true,
        scenes: {
          create: [
            { order: 0, text: "Clear ideas", templateId: "hf-statement" },
            { order: 1, text: "Review first", templateId: "hf-statement" },
          ],
        },
      },
    });
    const photo = await prisma.asset.create({
      data: { type: "image", path: "photo.svg" },
    });
    const firstScene = await prisma.scene.findFirstOrThrow({
      where: { scriptId: script.id, order: 0 },
    });
    const visualSettings = JSON.stringify({
      background: { type: "image", url: "/media/photo.svg", stock: true },
      items: ["Retained visual copy"],
    });
    await prisma.scene.update({
      where: { id: firstScene.id },
      data: {
        layoutJson: visualSettings,
        hideText: false,
        assetRefs: JSON.stringify([photo.id]),
      },
    });
    const rendition = {
      id: "full",
      url: "https://images.pexels.com/photos/42/photo42.jpg",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
    };
    const stockSnapshot = {
      schemaVersion: 1,
      resolvedAt: "2026-10-23T00:00:00Z",
      localAssetId: photo.id,
      contentHash: "b".repeat(64),
      selectedRendition: rendition,
      sourceRevision: {
        capturedAt: "2026-10-23T00:00:00Z",
        termsUrl: "https://www.pexels.com/license/",
      },
      usageEvent: { state: "not-required" },
      providerSnapshot: {
        providerId: "pexels",
        providerAssetId: "42",
        kind: "image",
        creator: "Fixture creator",
        sourcePageUrl: "https://www.pexels.com/photo/42/",
        previewUrl: rendition.url,
        width: 1080,
        height: 1920,
        orientation: "portrait",
        mimeType: "image/jpeg",
        renderRenditions: [rendition],
        attribution: { text: "Photo by Fixture creator", required: true },
        acquisitionPolicy: "download",
      },
    };
    await prisma.stockMediaSelection.create({
      data: {
        sceneId: firstScene.id,
        providerId: "pexels",
        providerAssetId: "42",
        kind: "image",
        localAssetId: photo.id,
        snapshotJson: JSON.stringify(stockSnapshot),
      },
    });
    const { languageSource, saveLanguageVersion, translateLanguageVersion } =
      await import("./language-versions");
    const source = await languageSource(script.id);
    const proposal = {
      sourceHash: source.sourceHash,
      language: "Spanish",
      paragraphs: source.paragraphs.map((p, i) => ({
        ...p,
        text: ["Ideas claras", "Revisa primero"][i],
        spokenText: ["Ideas claras", "Revisa primero"][i],
      })),
    };
    const created = await saveLanguageVersion(script.id, proposal);
    expect(mocks.generate).not.toHaveBeenCalled();
    const version = await prisma.script.findUniqueOrThrow({
      where: { id: created.scriptId },
      include: {
        scenes: {
          orderBy: { order: "asc" },
          include: { stockMediaSelection: true },
        },
        project: true,
      },
    });
    expect(version).toMatchObject({
      musicUrl: "/media/bed.wav",
      musicVolume: 44,
      hideText: true,
      project: { series: "Weekly" },
    });
    expect(version.scenes.map((s) => s.text)).toEqual([
      "Ideas claras",
      "Revisa primero",
    ]);
    expect(version.scenes[0]).toMatchObject({
      layoutJson: visualSettings,
      hideText: false,
      assetRefs: JSON.stringify([photo.id]),
    });
    expect(
      JSON.parse(version.scenes[0].stockMediaSelection!.snapshotJson),
    ).toEqual(stockSnapshot);
    expect(version.scenes[0].stockMediaSelection!.localAssetId).toBe(photo.id);
    expect(JSON.parse(version.brandOverrides!)).toMatchObject({
      translationSource: { scriptId: script.id, language: "Spanish" },
    });
    expect((await languageSource(script.id)).paragraphs).toEqual(
      source.paragraphs,
    );
    await expect(
      saveLanguageVersion(script.id, {
        ...proposal,
        paragraphs: proposal.paragraphs.slice(1),
      }),
    ).rejects.toThrow("every source paragraph");
    await prisma.stockMediaSelection.update({
      where: { sceneId: firstScene.id },
      data: {
        snapshotJson: JSON.stringify({
          ...stockSnapshot,
          contentHash: "a".repeat(64),
        }),
      },
    });
    await expect(saveLanguageVersion(script.id, proposal)).rejects.toThrow(
      "Source changed",
    );
    await prisma.stockMediaSelection.update({
      where: { sceneId: firstScene.id },
      data: { snapshotJson: JSON.stringify(stockSnapshot) },
    });
    mocks.generate.mockResolvedValueOnce({ scenes: [{ text: "Uno" }] });
    await expect(
      translateLanguageVersion(script.id, {
        providerId: "ollama",
        language: "Spanish",
      }),
    ).rejects.toThrow("coverage");
    mocks.generate.mockResolvedValueOnce({
      scenes: [{ text: "Ideas claras" }, { text: "Revisa primero" }],
    });
    expect(
      (
        await translateLanguageVersion(script.id, {
          providerId: "ollama",
          language: "Spanish",
        })
      ).paragraphs.map((p) => p.sceneId),
    ).toEqual(source.paragraphs.map((p) => p.sceneId));
    expect(mocks.generate.mock.calls.at(-1)?.[0]).toMatchObject({
      mode: "translate",
      translationLanguage: "Spanish",
      mediaPreference: "none",
    });
    await prisma.script.update({
      where: { id: script.id },
      data: { musicVolume: 12 },
    });
    await expect(saveLanguageVersion(script.id, proposal)).rejects.toThrow(
      "Source changed",
    );

    await prisma.stockMediaSelection.delete({
      where: { sceneId: firstScene.id },
    });
    const missingStock = await languageSource(script.id),
      projectCount = await prisma.project.count();
    await expect(
      saveLanguageVersion(script.id, {
        ...proposal,
        sourceHash: missingStock.sourceHash,
      }),
    ).rejects.toThrow("stock metadata needs review");
    expect(await prisma.project.count()).toBe(projectCount);

    const asset = await prisma.asset.create({
      data: { type: "audio", path: "bed.wav" },
    });
    await prisma.productionRevision.create({
      data: {
        projectId: project.id,
        scriptId: script.id,
        revisionHash: "test",
        snapshotJson: JSON.stringify({ asset: asset.id }),
      },
    });
    await prisma.productionJob.create({
      data: {
        kind: "test",
        idempotencyKey: "fixture",
        inputSnapshot: JSON.stringify({ nested: { url: "/media/bed.wav" } }),
      },
    });
    await prisma.factoryProfile.create({
      data: {
        key: "fixture",
        version: 1,
        name: "Fixture",
        digest: "fixture",
        documentJson: JSON.stringify({ audio: asset.path }),
      },
    });
    await prisma.sceneEdit.create({
      data: {
        scriptId: script.id,
        sceneId: "@script",
        beforeJson: JSON.stringify({
          layoutJson: JSON.stringify({ assetId: asset.id }),
        }),
        afterJson: "{}",
      },
    });
    const { getAssetUsage } = await import("./asset-usage"),
      { deleteAsset } = await import("./repositories/assets");
    expect((await getAssetUsage(asset.id))?.frozenCount).toBe(4);
    await expect(deleteAsset(asset.id)).rejects.toMatchObject({ status: 409 });
    expect(mocks.deleted).not.toHaveBeenCalled();

    const podcast = await prisma.podcast.create({
      data: { title: "Recording" },
    });
    const take = await prisma.podcastTake.create({
      data: {
        podcastId: podcast.id,
        providerId: "import",
        voiceId: "recording",
        totalFrames: 90,
        timingJson: "[]",
        audioPath: "recording.wav",
        mp3Path: "recording.mp3",
      },
    });
    const { saveReviewedPodcastTranscript } =
      await import("./podcast-transcription");
    const cues = [
      {
        turnId: "one",
        text: "Reviewed words",
        characterKey: "Guest",
        startFrame: 0,
        durationFrames: 60,
      },
    ];
    const reviewed = await saveReviewedPodcastTranscript(take.id, cues);
    expect(reviewed.timeline).toMatchObject(cues);
    expect(
      (
        await prisma.podcastTake.findUniqueOrThrow({
          where: { id: reviewed.id },
        })
      ).audioPath,
    ).toBe(take.audioPath);
    expect(
      (await prisma.podcastTake.findUniqueOrThrow({ where: { id: take.id } }))
        .timingJson,
    ).toBe("[]");
    await expect(
      saveReviewedPodcastTranscript(take.id, [
        { ...cues[0], durationFrames: 91 },
      ]),
    ).rejects.toThrow("within this take");
    await expect(
      saveReviewedPodcastTranscript(take.id, [
        cues[0],
        { ...cues[0], turnId: "two", startFrame: 30 },
      ]),
    ).rejects.toThrow("non-overlapping");
    const { deletePodcastTake } = await import("./repositories/podcasts");
    await deletePodcastTake(take.id);
    expect(mocks.deleted).not.toHaveBeenCalled();
    await deletePodcastTake(reviewed.id);
    expect(mocks.deleted.mock.calls.map((c) => c[0])).toEqual([
      "recording.wav",
      "recording.mp3",
    ]);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
