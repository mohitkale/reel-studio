// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const previousDatabaseUrl = process.env.DATABASE_URL;
afterEach(async () => {
  const state = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await state.prisma?.$disconnect();
  delete state.prisma;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  vi.resetModules();
});

it("persists visual direction in SQLite without changing content and rolls back failed updates", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-motion-direction-"));
  const filename = path.join(directory, "test.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort()) {
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  try {
    const { replanMotionDirection } =
      await import("./motion-direction-service");
    const originalLayout = JSON.stringify({
      role: "headline",
      motion: { recipeId: "type-impact", version: "1.0.0" },
      customPosition: 80,
      locks: { copy: true, assets: true, scene: false },
    });
    await prisma.project.create({
      data: {
        id: "project",
        name: "Direction test",
        scripts: {
          create: {
            id: "script",
            name: "Story",
            musicUrl: "/music/bed.wav",
            sfxJson: '{"enabled":false,"cues":[]}',
            brandOverrides: JSON.stringify({
              styleId: "clean-story",
              productionPreset: { id: "creator-punch", version: "1.0.0" },
            }),
            scenes: {
              create: [0, 1].map((order) => ({
                id: `scene-${order}`,
                order,
                templateId: "hf-statement",
                text: `Original text ${order}`,
                spokenText: `Original narration ${order}`,
                assetRefs: '["asset"]',
                layoutJson: originalLayout,
              })),
            },
          },
        },
      },
    });
    const before = await prisma.scene.findMany({
      where: { scriptId: "script" },
      orderBy: { order: "asc" },
    });
    expect(
      await replanMotionDirection("script", { ambition: "clean" }),
    ).toMatchObject({ changedSceneIds: ["scene-0", "scene-1"] });
    const after = await prisma.scene.findMany({
      where: { scriptId: "script" },
      orderBy: { order: "asc" },
    });
    for (const [index, scene] of after.entries()) {
      expect({
        ...scene,
        layoutJson: before[index].layoutJson,
        updatedAt: before[index].updatedAt,
      }).toEqual(before[index]);
      expect(JSON.parse(scene.layoutJson!)).toMatchObject({
        customPosition: 80,
        motion: { recipeId: "type-editorial" },
        locks: { copy: true, assets: true },
      });
    }
    const saved = await prisma.script.findUniqueOrThrow({
      where: { id: "script" },
    });
    expect(saved.musicUrl).toBe("/music/bed.wav");
    expect(saved.sfxJson).toBe('{"enabled":false,"cues":[]}');
    expect(JSON.parse(saved.brandOverrides!).motionPlan).toEqual({
      version: "1.0.0",
      seed: "script",
      ambition: "clean",
    });
    expect(
      await replanMotionDirection("script", { ambition: "clean" }),
    ).toMatchObject({ changedSceneIds: [] });

    await prisma.script.update({
      where: { id: "script" },
      data: {
        brandOverrides: JSON.stringify({
          ...JSON.parse(saved.brandOverrides!),
          chapterPlan: {
            version: "1.0.0",
            chapters: [
              { id: "one", title: "One", firstSceneId: "scene-0" },
              { id: "two", title: "Two", firstSceneId: "scene-1" },
            ],
          },
        }),
      },
    });
    await replanMotionDirection("script", { chapterMotifs: true });
    const { getScript } = await import("./repositories/scripts");
    const directed = (await getScript("script"))!;
    expect(directed.scenes[0].motion!.typeEntrance).not.toBe(
      directed.scenes[1].motion!.typeEntrance,
    );
    expect((await replanMotionDirection("script", {})).state).toBe("planned");
    expect(await replanMotionDirection("script", {})).toMatchObject({
      changedSceneIds: [],
    });
    const { captureVideoSnapshot } = await import("./video-snapshot");
    const { restoreProductionRevision } =
      await import("./restore-production-revision");
    const restored = await restoreProductionRevision(
      await captureVideoSnapshot("script"),
    );
    const restoredScript = (await getScript(restored.scriptId))!;
    expect(restoredScript.motionPlan!.chapterMotifs).toBe(true);
    expect(restoredScript.scenes.map((scene) => scene.motion)).toEqual(
      directed.scenes.map((scene) => scene.motion),
    );
    await replanMotionDirection("script", { chapterMotifs: false });
    expect(
      (await getScript("script"))!.scenes.every(
        (scene) => !scene.motion?.typeEntrance,
      ),
    ).toBe(true);

    await prisma.scene.updateMany({
      where: { scriptId: "script" },
      data: { layoutJson: originalLayout },
    });
    const beforeFailure = await prisma.script.findUniqueOrThrow({
      where: { id: "script" },
    });
    db.exec(
      `CREATE TRIGGER fail_motion BEFORE UPDATE ON Scene WHEN OLD.id = 'scene-1' BEGIN SELECT RAISE(ABORT, 'direction rollback test'); END;`,
    );
    await expect(
      replanMotionDirection("script", {
        ambition: "clean",
        newVariation: true,
      }),
    ).rejects.toThrow();
    const rolledBack = await prisma.scene.findMany({
      where: { scriptId: "script" },
    });
    expect(
      rolledBack.every((scene) => scene.layoutJson === originalLayout),
    ).toBe(true);
    expect(
      (await prisma.script.findUniqueOrThrow({ where: { id: "script" } }))
        .brandOverrides,
    ).toBe(beforeFailure.brandOverrides);
  } finally {
    db.close();
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15_000);
