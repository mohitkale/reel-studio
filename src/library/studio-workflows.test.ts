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
      include: { scenes: { orderBy: { order: "asc" } }, project: true },
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
