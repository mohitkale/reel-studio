// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { filmSnapshot } from "../../tests/fixtures/film-plan";

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

it("checkpoints, reads and restores choices in SQLite; rejects stale/forged plans without writes", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-film-plan-"));
  const filename = path.join(directory, "test.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  try {
    const { readFilmPlanDocument, saveFilmPlanDocument } =
      await import("./film-plan-service");
    const { getScript } = await import("./repositories/scripts");
    const { restoreProductionRevision } =
      await import("./restore-production-revision");
    const { captureVideoSnapshot } = await import("./video-snapshot");
    const fixture = filmSnapshot();
    await prisma.project.create({
      data: {
        id: "project",
        name: "M1 fixture",
        scripts: {
          create: {
            id: "script",
            name: fixture.script.name,
            brandOverrides: JSON.stringify({
              motionPlan: fixture.script.motionPlan,
            }),
            scenes: {
              create: fixture.script.scenes.map((scene) => ({
                id: scene.id,
                order: scene.order,
                templateId: scene.templateId,
                text: scene.text,
                spokenText: scene.spokenText,
                emphasis: JSON.stringify(scene.emphasis),
                hideText: scene.hideText,
                layoutJson: JSON.stringify({
                  motion: scene.motion,
                  direction: scene.direction,
                  locks: scene.locks,
                }),
              })),
            },
          },
        },
      },
    });
    const document = await readFilmPlanDocument("script");
    const wire = JSON.parse(JSON.stringify(document));
    const saved = await saveFilmPlanDocument("script", wire);
    expect(
      await readFilmPlanDocument("script", { revisionId: saved.revisionId }),
    ).toEqual(document);
    const revision = await prisma.productionRevision.findUniqueOrThrow({
      where: { id: saved.revisionId },
    });
    expect(JSON.parse(revision.snapshotJson).filmPlan).toEqual(
      document.snapshot.filmPlan,
    );
    const before = await getScript("script");
    const restored = await restoreProductionRevision(
      JSON.parse(revision.snapshotJson),
    );
    const after = (await getScript(restored.scriptId))!;
    expect(
      after.scenes.map((s) => [
        s.templateId,
        s.text,
        s.spokenText,
        s.motion,
        s.direction,
        s.locks,
      ]),
    ).toEqual(
      before!.scenes.map((s) => [
        s.templateId,
        s.text,
        s.spokenText,
        s.motion,
        s.direction,
        s.locks,
      ]),
    );
    const restoredSnapshot = await captureVideoSnapshot(restored.scriptId);
    expect(restoredSnapshot.filmPlan!.shots.map((s) => s.sceneId)).toEqual(
      after.scenes.map((s) => s.id),
    );
    expect(restoredSnapshot.filmPlan!.sourceHash).not.toBe(
      document.snapshot.filmPlan!.sourceHash,
    );
    const forged = structuredClone(document);
    forged.snapshot.filmPlan!.shots[0].binding.sceneHash = `sha256:${"0".repeat(64)}`;
    await expect(saveFilmPlanDocument("script", forged)).rejects.toMatchObject({
      status: 400,
    });
    await expect(saveFilmPlanDocument("other", document)).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(readFilmPlanDocument("missing")).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      readFilmPlanDocument(restored.scriptId, { revisionId: saved.revisionId }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readFilmPlanDocument("script", { voiceTakeId: "missing" }),
    ).rejects.toMatchObject({ status: 400 });
    await prisma.scene.update({
      where: { id: "legacy" },
      data: { text: "A later edit" },
    });
    await expect(
      saveFilmPlanDocument("script", document),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.productionRevision.count()).toBe(1);
    expect(
      (await readFilmPlanDocument("script", { revisionId: saved.revisionId }))
        .snapshot.script.scenes[0].text,
    ).toBe("A clear introduction");
    // Old revisions gain a derived view only; their stored bytes remain unchanged.
    const legacy = structuredClone(document.snapshot);
    delete legacy.filmPlan;
    const old = await prisma.productionRevision.create({
      data: {
        projectId: "project",
        scriptId: "script",
        revisionHash: "old",
        snapshotJson: JSON.stringify(legacy),
      },
    });
    expect(
      (await readFilmPlanDocument("script", { revisionId: old.id })).snapshot
        .filmPlan,
    ).toBeDefined();
    expect(
      (
        await prisma.productionRevision.findUniqueOrThrow({
          where: { id: old.id },
        })
      ).snapshotJson,
    ).toBe(old.snapshotJson);
  } finally {
    db.close();
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
