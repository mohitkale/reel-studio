// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChapterDraft } from "@/production/chapter-draft";
const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  configured: vi.fn(),
  media: vi.fn(),
}));
vi.mock("@/providers/ai/registry", () => ({
  getAIProvider: () => ({
    label: "Fixture",
    generatePlan: mocks.generate,
    isConfigured: mocks.configured,
  }),
}));
vi.mock("@/library/automatic-stock-media", () => ({
  resolveAutomaticSceneMediaBatch: mocks.media,
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
it("generates one reviewed chapter, resumes/retries pending work and atomically preserves earlier scenes and progress", async () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "reel-chapter-generation-"),
  );
  const filename = path.join(directory, "generation.db");
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
  const { generateDraftChapter } = await import("./chapter-generation-service");
  const { saveChapterDraft } = await import("./chapter-draft-service");
  const { getScript } = await import("./repositories/scripts");
  const { captureVideoSnapshot } = await import("./video-snapshot");
  const { restoreProductionRevision } =
    await import("./restore-production-revision");
  const draft: ChapterDraft = {
    version: "1.0.0",
    topic: "Supplied workflow facts",
    chapters: [
      {
        id: "proof",
        title: "Proof",
        brief: "Explain the supplied proof",
        sceneCount: 2,
      },
      {
        id: "takeaway",
        title: "Takeaway",
        brief: "Explain the supplied takeaway",
        sceneCount: 2,
      },
    ],
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
        text: "Supplied proof",
        spokenText: "Here is the supplied proof",
        emphasis: [],
      },
      {
        templateId: "hf-statement",
        text: "Conclusion",
        spokenText: "Here is the supplied conclusion",
        emphasis: [],
      },
    ],
  };
  mocks.generate.mockResolvedValue(result);
  mocks.configured.mockReturnValue(true);
  mocks.media.mockImplementation(async (scenes) =>
    scenes.map(() => ({
      state: "skipped",
      attemptedProviders: [],
      message: "No media",
    })),
  );
  const authorize = vi.fn().mockResolvedValue("web");
  const input = (expected: ChapterDraft, chapterId = "proof") => ({
    providerId: "openai" as const,
    expected,
    chapterId,
    maxProviderCalls: 1 as const,
    mediaPreference: "none" as const,
  });
  try {
    await prisma.project.create({
      data: {
        id: "project",
        name: "Chapters",
        videoEngine: "hyperframes",
        scripts: {
          create: {
            id: "script",
            name: "Story",
            brandOverrides: JSON.stringify({
              chapterPlan: plan,
              chapterDraft: draft,
              customBrandField: "kept",
              audioMastering: "balanced",
            }),
            scenes: {
              create: Array.from({ length: 3 }, (_, index) => ({
                id: `scene-${index}`,
                order: index,
                templateId: "hf-statement",
                text: `Original ${index}`,
                spokenText: `Voice ${index}`,
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
    for (const invalid of [
      input(draft, "takeaway"),
      input(draft, "missing"),
      input({ ...draft, topic: "Stale topic" }),
    ])
      await expect(
        generateDraftChapter("script", invalid, authorize),
      ).rejects.toBeInstanceOf(Error);
    expect(authorize).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    mocks.configured.mockReturnValueOnce(false);
    await expect(
      generateDraftChapter("script", input(draft), authorize),
    ).rejects.toMatchObject({ status: 400 });
    const alreadyCanceled = new AbortController();
    alreadyCanceled.abort();
    await expect(
      generateDraftChapter(
        "script",
        input(draft),
        authorize,
        alreadyCanceled.signal,
      ),
    ).rejects.toMatchObject({ status: 499 });
    const tooMany: ChapterDraft = {
      ...draft,
      chapters: Array.from({ length: 12 }, (_, index) => ({
        ...draft.chapters[0],
        id: `limit-${index}`,
      })),
    };
    for (const [overrides, expected] of [
      [{ chapterPlan: plan, chapterDraft: tooMany }, tooMany],
      [{ chapterDraft: draft }, draft],
    ] as const) {
      await prisma.script.update({
        where: { id: "script" },
        data: { brandOverrides: JSON.stringify(overrides) },
      });
      await expect(
        generateDraftChapter(
          "script",
          input(expected, expected.chapters[0].id),
          authorize,
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    await prisma.script.update({
      where: { id: "script" },
      data: {
        brandOverrides: JSON.stringify({
          chapterPlan: plan,
          chapterDraft: draft,
          customBrandField: "kept",
          audioMastering: "balanced",
        }),
      },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    const first = await generateDraftChapter("script", input(draft), authorize);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "append",
        chapterTitle: "Proof",
        sceneCount: 2,
        scriptStyle: "detailed",
        videoEngine: "hyperframes",
        mediaPreference: "none",
      }),
    );
    const context = mocks.generate.mock.lastCall![0].existingContext;
    expect(context).toContain("Original 1");
    expect(context).not.toContain("Original 0");
    expect(first.scenes.slice(0, 3)).toEqual(before.scenes);
    expect(first.chapterPlan!.chapters.slice(0, 1)).toEqual(
      before.chapterPlan!.chapters,
    );
    const completed = first.chapterDraft!.chapters[0].generated!;
    expect(completed.sceneIds).toEqual(
      first.scenes.slice(3).map((scene) => scene.id),
    );
    expect(completed.chapterId).toBe(first.chapterPlan!.chapters[1].id);
    expect(first.chapterDraft!.chapters[1].generated).toBeUndefined();
    expect(
      JSON.parse(
        (await prisma.script.findUniqueOrThrow({ where: { id: "script" } }))
          .brandOverrides!,
      ),
    ).toMatchObject({ customBrandField: "kept", audioMastering: "balanced" });
    await expect(
      generateDraftChapter("script", input(first.chapterDraft!), authorize),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    // Saved progress survives native revision restoration with scene ID remapping.
    const restored = await restoreProductionRevision(
      await captureVideoSnapshot("script"),
    );
    const restoredScript = (await getScript(restored.scriptId))!;
    expect(
      restoredScript.chapterDraft!.chapters[0].generated!.sceneIds,
    ).toEqual(restoredScript.scenes.slice(3).map((scene) => scene.id));
    expect(restoredScript.chapterDraft!.chapters[0].generated!.chapterId).toBe(
      completed.chapterId,
    );
    const pending = (await getScript("script"))!.chapterDraft!;
    // No public edit can erase or forge completion, including the same scene count.
    await expect(
      saveChapterDraft("script", { expected: pending, draft }),
    ).rejects.toMatchObject({ status: 400 });
    const edited = {
      ...pending,
      chapters: pending.chapters.map((chapter) =>
        chapter.generated
          ? chapter
          : { ...chapter, brief: "Revised supplied takeaway" },
      ),
    };
    await saveChapterDraft("script", { expected: pending, draft: edited });
    for (const output of [
      new Error("Provider offline"),
      { ...result, scenes: result.scenes.slice(0, 1) },
    ]) {
      if (output instanceof Error) mocks.generate.mockRejectedValueOnce(output);
      else mocks.generate.mockResolvedValueOnce(output);
      await expect(
        generateDraftChapter("script", input(edited, "takeaway"), authorize),
      ).rejects.toBeInstanceOf(Error);
      expect((await getScript("script"))!.chapterDraft).toEqual(edited);
      expect(await prisma.scene.count({ where: { scriptId: "script" } })).toBe(
        5,
      );
    }
    // Cancellation and metadata failure roll back all progress and generated rows.
    const cancel = new AbortController();
    mocks.generate.mockImplementationOnce(async () => {
      cancel.abort();
      return result;
    });
    await expect(
      generateDraftChapter(
        "script",
        input(edited, "takeaway"),
        authorize,
        cancel.signal,
      ),
    ).rejects.toMatchObject({ status: 499 });
    mocks.media.mockResolvedValueOnce([]);
    await expect(
      generateDraftChapter("script", input(edited, "takeaway"), authorize),
    ).rejects.toMatchObject({ status: 502 });
    // A human edit during generation wins, with no appended scenes or completion.
    mocks.generate.mockImplementationOnce(async () => {
      await prisma.scene.update({
        where: { id: "scene-2" },
        data: { text: "Human edit" },
      });
      return result;
    });
    await expect(
      generateDraftChapter("script", input(edited, "takeaway"), authorize),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getScript("script"))!.chapterDraft).toEqual(edited);
    expect(await prisma.scene.count({ where: { scriptId: "script" } })).toBe(5);
    // Concurrent attempts at the same pending chapter: exactly one commits.
    let entered = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.generate.mockImplementation(async () => {
      if (++entered === 2) release();
      await gate;
      return result;
    });
    const attempts = await Promise.allSettled([
      generateDraftChapter("script", input(edited, "takeaway"), authorize),
      generateDraftChapter("script", input(edited, "takeaway"), authorize),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toMatchObject([{ reason: { status: 409 } }]);
    const done = (await getScript("script"))!;
    expect(done.scenes).toHaveLength(7);
    expect(
      done.chapterDraft!.chapters.every((chapter) => chapter.generated),
    ).toBe(true);
    // A deleted generated scene never silently turns into another billable append.
    await prisma.scene.delete({ where: { id: completed.sceneIds[1] } });
    await expect(
      generateDraftChapter(
        "script",
        input(done.chapterDraft!, "takeaway"),
        authorize,
      ),
    ).rejects.toMatchObject({ status: 409 });
    // Empty storyboards initialize their first chapter in the same transaction.
    await prisma.script.create({
      data: {
        id: "empty",
        name: "Empty",
        projectId: "project",
        brandOverrides: JSON.stringify({ chapterDraft: draft }),
      },
    });
    mocks.generate.mockResolvedValue(result);
    const initial = await generateDraftChapter(
      "empty",
      input(draft),
      authorize,
    );
    expect(initial.scenes).toHaveLength(2);
    expect(initial.chapterPlan!.chapters).toHaveLength(1);
    expect(initial.chapterPlan!.chapters[0].firstSceneId).toBe(
      initial.scenes[0].id,
    );
    expect(initial.chapterDraft!.chapters[0].generated!.sceneIds).toEqual(
      initial.scenes.map((scene) => scene.id),
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
