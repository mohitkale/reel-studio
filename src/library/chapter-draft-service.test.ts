// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), configured: vi.fn() }));
vi.mock("@/providers/ai/registry", () => ({
  getAIProvider: () => ({
    label: "Fixture",
    generatePlan: mocks.generate,
    isConfigured: mocks.configured,
  }),
}));
const previousUrl = process.env.DATABASE_URL;
afterEach(async () => {
  const state = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await state.prisma?.$disconnect();
  delete state.prisma;
  if (previousUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousUrl;
  vi.resetModules();
  vi.resetAllMocks();
});
it("persists one bounded writing generation, preserves scenes/settings, and safely rejects failed or stale drafts", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-topic-draft-"));
  const filename = path.join(directory, "draft.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  db.close();
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  const { generateChapterDraft, saveChapterDraft } =
    await import("./chapter-draft-service");
  const { getScript } = await import("./repositories/scripts");
  const { captureVideoSnapshot } = await import("./video-snapshot");
  const { restoreProductionRevision } =
    await import("./restore-production-revision");
  const input = {
    providerId: "openai" as const,
    topic: "Workflow facts supplied by the creator",
    chapterCount: 2,
    scenesPerChapter: 4,
  };
  const plan = {
    version: "1.0.0",
    chapters: [{ id: "intro", title: "Introduction", firstSceneId: "scene-0" }],
  };
  const result = {
    projectName: "Project",
    scriptName: "Script",
    scenes: [
      {
        templateId: "hf-statement",
        text: "The problem",
        spokenText: "Explain the supplied workflow problem",
        emphasis: [],
      },
      {
        templateId: "hf-statement",
        text: "The solution",
        spokenText: "Explain the supplied solution with a takeaway",
        emphasis: [],
      },
    ],
  };
  mocks.generate.mockResolvedValue(result);
  mocks.configured.mockReturnValue(true);
  const authorize = vi.fn().mockResolvedValue("web");
  try {
    await prisma.project.create({
      data: {
        id: "project",
        name: "Topic planning",
        scripts: {
          create: {
            id: "script",
            name: "Story",
            brandOverrides: JSON.stringify({
              chapterPlan: plan,
              customBrandField: "kept",
              audioMastering: "balanced",
            }),
            scenes: {
              create: Array.from({ length: 3 }, (_, index) => ({
                id: `scene-${index}`,
                order: index,
                templateId: "hf-statement",
                text: `Original ${index}`,
                spokenText: `Original voice ${index}`,
                layoutJson: JSON.stringify({
                  locks: { scene: true, copy: true, assets: true },
                }),
              })),
            },
          },
        },
      },
    });
    const before = (await getScript("script"))!;
    const draft = (await generateChapterDraft("script", input, authorize))!;
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "chapter_outline",
        sceneCount: 2,
        brief: input.topic,
        mediaPreference: "none",
      }),
    );
    const context = mocks.generate.mock.lastCall![0].existingContext;
    expect(context).toContain("Introduction");
    expect(context).toContain("Original 1");
    expect(context).not.toContain("Original 0");
    const after = (await getScript("script"))!;
    expect(after.scenes).toEqual(before.scenes);
    expect(after.chapterPlan).toEqual(before.chapterPlan);
    expect(after.chapterDraft).toEqual(draft);
    expect(draft.chapters.map((chapter) => chapter.sceneCount)).toEqual([4, 4]);
    expect(
      JSON.parse(
        (await prisma.script.findUniqueOrThrow({ where: { id: "script" } }))
          .brandOverrides!,
      ),
    ).toMatchObject({ customBrandField: "kept", audioMastering: "balanced" });
    // Drafts survive reload and restoration without generating storyboard scenes.
    const snapshot = await captureVideoSnapshot("script");
    expect(snapshot.script.chapterDraft).toEqual(draft);
    const restored = await restoreProductionRevision(snapshot);
    expect((await getScript(restored.scriptId))!.chapterDraft).toEqual(draft);
    const edited = {
      ...draft,
      chapters: draft.chapters.map((chapter) => ({
        ...chapter,
        title: `${chapter.title} revised`,
      })),
    };
    await saveChapterDraft("script", { expected: draft, draft: edited });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    await expect(
      saveChapterDraft("script", { expected: draft, draft }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      generateChapterDraft("script", { ...input, chapterCount: 12 }, authorize),
    ).rejects.toMatchObject({ status: 400 });
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    mocks.generate.mockRejectedValueOnce(new Error("Provider offline"));
    await expect(
      generateChapterDraft("script", input, authorize),
    ).rejects.toThrow("Provider offline");
    expect((await getScript("script"))!.chapterDraft).toEqual(edited);
    mocks.generate.mockResolvedValueOnce({
      ...result,
      scenes: result.scenes.slice(0, 1),
    });
    await expect(
      generateChapterDraft("script", input, authorize),
    ).rejects.toMatchObject({ status: 502 });
    mocks.generate.mockResolvedValueOnce({
      ...result,
      scenes: result.scenes.map((scene) => ({ ...scene, spokenText: "" })),
    });
    await expect(
      generateChapterDraft("script", input, authorize),
    ).rejects.toThrow();
    expect((await getScript("script"))!.chapterDraft).toEqual(edited);
    // Content, chapter outline and competing draft edits all reject the old generation.
    for (const change of [
      () =>
        prisma.scene.update({
          where: { id: "scene-2" },
          data: { text: "Human edit" },
        }),
      () =>
        prisma.script.update({
          where: { id: "script" },
          data: {
            brandOverrides: JSON.stringify({
              chapterPlan: {
                ...plan,
                chapters: [{ ...plan.chapters[0], title: "New title" }],
              },
              chapterDraft: edited,
            }),
          },
        }),
      () => saveChapterDraft("script", { expected: edited, draft }),
    ]) {
      mocks.generate.mockImplementationOnce(async () => {
        await change();
        return result;
      });
      const scenes = await prisma.scene.count({
        where: { scriptId: "script" },
      });
      await expect(
        generateChapterDraft("script", input, authorize),
      ).rejects.toMatchObject({ status: 409 });
      expect(await prisma.scene.count({ where: { scriptId: "script" } })).toBe(
        scenes,
      );
    }
    expect((await getScript("script"))!.chapterDraft).toEqual(draft);
    const cancel = new AbortController();
    mocks.generate.mockImplementationOnce(async () => {
      cancel.abort();
      return result;
    });
    await expect(
      generateChapterDraft("script", input, authorize, cancel.signal),
    ).rejects.toMatchObject({ status: 499 });
    expect((await getScript("script"))!.chapterDraft).toEqual(draft);
    await saveChapterDraft("script", { expected: draft, draft: null });
    expect((await getScript("script"))!.chapterDraft).toBeUndefined();
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, process.platform === "win32" ? 30_000 : 5_000);
