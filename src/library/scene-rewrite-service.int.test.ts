// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AIScene } from "@/providers/ai/types";
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
it("rewrites only a bounded chapter and atomically rejects content, lock, order, outline and cancellation races", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-chapter-rewrite-"));
  const filename = path.join(directory, "rewrite.db");
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
    const { captureSceneRewriteState, commitSceneRewrite } =
      await import("./scene-rewrite-service");
    const { prepareRegenerationScope } =
      await import("./selective-scene-regeneration");
    const { getScript } = await import("./repositories/scripts");
    const plan = {
      version: "1.0.0",
      chapters: [
        { id: "first", title: "The question", firstSceneId: "scene-0" },
        { id: "second", title: "The proof", firstSceneId: "scene-20" },
      ],
    };
    await prisma.project.create({
      data: {
        id: "project",
        name: "A long story",
        scripts: {
          create: {
            id: "script",
            name: "Bounded sections",
            brandOverrides: JSON.stringify({ chapterPlan: plan }),
            scenes: {
              create: Array.from({ length: 24 }, (_, index) => ({
                id: `scene-${index}`,
                order: index,
                templateId: "kinetic",
                text: `Original ${index}`,
                spokenText: `Narration ${index}`,
                assetRefs: JSON.stringify([`asset-${index}`]),
                layoutJson: JSON.stringify({
                  motion: { recipeId: "type-editorial", version: "1.0.0" },
                  locks: {
                    copy: index === 21,
                    assets: true,
                    scene: index === 22,
                  },
                }),
              })),
            },
          },
        },
      },
    });
    const before = (await getScript("script"))!;
    const scope = prepareRegenerationScope(before, { chapterId: "second" });
    expect(scope.positions).toEqual([21, 22, 24]);
    expect(scope.context).toContain("Scene 20");
    expect(scope.context).not.toContain("Scene 1 [");
    const generated: AIScene[] = scope.targets.map((_, index) => ({
      templateId: "kinetic",
      text: `Fresh ${index}`,
      spokenText: `Fresh voice ${index}`,
      emphasis: [],
    }));
    const mediaDecisions = scope.targets.map(() => ({
      state: "disabled" as const,
      attemptedProviders: [],
      message: "No stock",
    }));
    const input = {
      scriptId: "script",
      expectedState: await captureSceneRewriteState("script"),
      targets: scope.targets,
      generated,
      mediaDecisions,
    };
    await commitSceneRewrite(input);
    const after = (await getScript("script"))!;
    expect(after.scenes.slice(0, 20)).toEqual(before.scenes.slice(0, 20));
    expect(after.scenes[22]).toEqual(before.scenes[22]);
    expect(after.scenes[21].text).toBe(before.scenes[21].text);
    expect(after.scenes[21].spokenText).toBe(before.scenes[21].spokenText);
    expect(after.chapterPlan).toEqual(before.chapterPlan);
    expect(
      after.scenes.map((scene) => [scene.id, scene.assetRefs, scene.motion]),
    ).toEqual(
      before.scenes.map((scene) => [scene.id, scene.assetRefs, scene.motion]),
    );
    await expect(commitSceneRewrite(input)).rejects.toMatchObject({
      status: 409,
    });
    for (const change of [
      () =>
        prisma.scene.update({
          where: { id: "scene-20" },
          data: { text: "Human edit" },
        }),
      () =>
        prisma.scene.update({
          where: { id: "scene-20" },
          data: {
            layoutJson: JSON.stringify({
              locks: { copy: true, assets: true, scene: true },
            }),
          },
        }),
      () =>
        prisma.scene.update({ where: { id: "scene-23" }, data: { order: 25 } }),
      () =>
        prisma.script.update({
          where: { id: "script" },
          data: {
            brandOverrides: JSON.stringify({
              chapterPlan: {
                ...plan,
                chapters: plan.chapters.map((chapter) => ({
                  ...chapter,
                  title: "Updated",
                })),
              },
            }),
          },
        }),
    ]) {
      const expectedState = await captureSceneRewriteState("script");
      await change();
      const frozen = await prisma.scene.findMany({
        where: { scriptId: "script" },
        orderBy: { order: "asc" },
      });
      await expect(
        commitSceneRewrite({ ...input, expectedState }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await prisma.scene.findMany({
          where: { scriptId: "script" },
          orderBy: { order: "asc" },
        }),
      ).toEqual(frozen);
    }
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(
      commitSceneRewrite({
        ...input,
        expectedState: await captureSceneRewriteState("script"),
        signal: cancellation.signal,
      }),
    ).rejects.toMatchObject({ status: 499 });
    await expect(
      commitSceneRewrite({ ...input, generated: [] }),
    ).rejects.toMatchObject({ status: 502 });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, process.platform === "win32" ? 30_000 : 5_000);
