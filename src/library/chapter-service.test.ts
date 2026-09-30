// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chapterPlanIssue } from "@/production/chapters";
import { parseSfxState, resolveReelSfxCues } from "@/lib/sfx-cues";
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
});
it("persists chapters without changing content and rejects concurrent scene/outline edits", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-chapters-"));
  const filename = path.join(directory, "review.db");
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
  try {
    const { proposeScriptChapters, saveChapterPlan } =
      await import("./chapter-service");
    const { getScript } = await import("./repositories/scripts");
    const { captureVideoSnapshot } = await import("./video-snapshot");
    const { restoreProductionRevision } =
      await import("./restore-production-revision");
    await prisma.project.create({
      data: {
        id: "project",
        name: "Chapters",
        scripts: {
          create: {
            id: "script",
            name: "An outlined story",
            sfxJson: JSON.stringify({
              enabled: true,
              cues: [
                {
                  sceneId: "scene-0",
                  sfxId: "soft-hit",
                  offsetSeconds: 0.7,
                  volume: 0.25,
                  source: "manual",
                  locked: true,
                },
                {
                  sceneId: "scene-20",
                  sfxId: "whoosh",
                  offsetSeconds: 0.1,
                  volume: 0.4,
                  source: "automatic",
                  event: {
                    recipeId: "type-editorial",
                    version: "1.0.0",
                    anchor: "reveal",
                  },
                },
                {
                  sceneId: "scene-23",
                  sfxId: "pop",
                  offsetSeconds: 0,
                  volume: 0,
                  source: "manual",
                },
                {
                  sceneId: "already-deleted",
                  sfxId: "click",
                  offsetSeconds: 0,
                  volume: 0.2,
                },
              ],
            }),
            brandOverrides: JSON.stringify({
              customBrandField: "kept",
              audioMastering: "balanced",
            }),
            scenes: {
              create: Array.from({ length: 24 }, (_, index) => ({
                id: `scene-${index}`,
                order: index,
                templateId: "hf-statement",
                text: `Every scene keeps its content ${index}`,
                spokenText: `The measured narration ${index}`,
                hideText: index === 0 ? false : index === 1 ? true : null,
                layoutJson: JSON.stringify({
                  role: "headline",
                  motion: { recipeId: "type-editorial", version: "1.0.0" },
                }),
              })),
            },
          },
        },
      },
    });
    const before = await getScript("script");
    const proposal = await proposeScriptChapters("script");
    expect(proposal).toMatchObject({
      expected: null,
      timingSource: "estimated",
    });
    expect((await getScript("script"))?.chapterPlan).toBeUndefined();
    const plan = {
      ...proposal.proposal,
      chapters: proposal.proposal.chapters.map((chapter, index) => ({
        ...chapter,
        title: index ? "The proof" : "The question",
      })),
    };
    await saveChapterPlan("script", {
      expected: null,
      expectedSceneIds: proposal.expectedSceneIds,
      plan,
    });
    const after = await getScript("script");
    expect(after?.chapterPlan).toEqual(plan);
    expect(after?.scenes).toEqual(before?.scenes);
    expect(after?.audioMastering).toBe("balanced");
    const row = await prisma.script.findUniqueOrThrow({
      where: { id: "script" },
    });
    expect(JSON.parse(row.brandOverrides!)).toMatchObject({
      customBrandField: "kept",
    });
    await expect(
      saveChapterPlan("script", {
        expected: null,
        expectedSceneIds: proposal.expectedSceneIds,
        plan,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveChapterPlan("script", {
        expected: plan,
        expectedSceneIds: proposal.expectedSceneIds,
        plan: { ...plan, chapters: [plan.chapters[0]] },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      proposeScriptChapters("script", "unrelated-take"),
    ).rejects.toMatchObject({ status: 400 });
    const snapshot = await captureVideoSnapshot("script");
    expect(snapshot.script.chapterPlan).toEqual(plan);
    const restored = await restoreProductionRevision(snapshot);
    const copy = await getScript(restored.scriptId);
    expect(copy?.scenes).toHaveLength(24);
    expect(copy?.scenes.map((scene) => scene.text)).toEqual(
      before?.scenes.map((scene) => scene.text),
    );
    expect(copy?.chapterPlan?.chapters.map((chapter) => chapter.title)).toEqual(
      ["The question", "The proof"],
    );
    expect(
      chapterPlanIssue(
        copy!.chapterPlan!,
        copy!.scenes.map((scene) => scene.id),
      ),
    ).toBeUndefined();
    expect(copy?.chapterPlan?.chapters[1].firstSceneId).toBe(
      copy?.scenes[20].id,
    );
    expect(copy?.scenes.map((scene) => scene.hideText)).toEqual(
      before?.scenes.map((scene) => scene.hideText),
    );
    const originalCues = parseSfxState(snapshot.script.sfxJson).cues;
    const restoredCues = parseSfxState(copy!.sfxJson).cues;
    expect(restoredCues).toEqual(
      originalCues.slice(0, 3).map((cue, index) => ({
        ...cue,
        sceneId: copy!.scenes[[0, 20, 23][index]].id,
      })),
    );
    const timeline = snapshot.script.scenes.map((scene, index) => ({
      sceneId: scene.id,
      startFrame: index * 90,
      durationFrames: 90,
    }));
    const originalSound = resolveReelSfxCues({
      sfxEnabled: true,
      sfxJson: snapshot.script.sfxJson,
      timeline,
      fps: 30,
      videoEngine: snapshot.script.videoEngine,
      scenes: snapshot.script.scenes,
    });
    const restoredSound = resolveReelSfxCues({
      sfxEnabled: true,
      sfxJson: copy!.sfxJson,
      timeline: timeline.map((beat, index) => ({
        ...beat,
        sceneId: copy!.scenes[index].id,
      })),
      fps: 30,
      videoEngine: copy!.videoEngine,
      scenes: copy!.scenes,
    });
    expect(restoredSound).toEqual(originalSound);
    await prisma.scene.update({
      where: { id: "scene-0" },
      data: { order: 25 },
    });
    await expect(
      saveChapterPlan("script", {
        expected: plan,
        expectedSceneIds: proposal.expectedSceneIds,
        plan,
      }),
    ).rejects.toMatchObject({ status: 409 });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
