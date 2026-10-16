// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
});

it("persists scoped review/apply/undo across a fresh database connection and protects later edits", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-m4-"));
  const filename = path.join(directory, "test.db");
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
  let { prisma } = await import("./db");
  try {
    await prisma.project.create({
      data: {
        id: "m4",
        name: "M4 fixture",
        scripts: {
          create: {
            id: "film",
            name: "Review",
            brandOverrides: JSON.stringify({
              productionPreset: { id: "editorial-explainer", version: "1.0.0" },
              motionPlan: {
                version: "1.0.0",
                seed: "saved",
                ambition: "expressive",
              },
            }),
            scenes: {
              create: ["a", "b"].map((id, order) => ({
                id,
                order,
                text: "A clear supplied explanation",
                spokenText: "Keep original narration",
                templateId: "hf-statement",
                layoutJson: JSON.stringify({
                  role: "explanation",
                  motion: { recipeId: "type-impact", version: "1.0.0" },
                  locks: { copy: true, assets: true, scene: order === 1 },
                }),
              })),
            },
          },
        },
      },
    });
    let { replanMotionDirection } = await import("./motion-direction-service");
    const before = await prisma.scene.findMany({ orderBy: { order: "asc" } });
    const proposal = await replanMotionDirection("film", {
      preview: true,
      ambition: "clean",
      sceneIds: ["a"],
    });
    if (proposal.state !== "planned") throw new Error("Expected proposal");
    expect(await prisma.scene.findMany({ orderBy: { order: "asc" } })).toEqual(
      before,
    );
    await replanMotionDirection("film", {
      ambition: "clean",
      sceneIds: ["a"],
      variationSeed: proposal.settings.seed,
      expectedHash: proposal.sourceHash,
    });
    expect(
      (await prisma.scene.findUniqueOrThrow({ where: { id: "b" } })).layoutJson,
    ).toBe(before[1].layoutJson);
    await prisma.$disconnect();
    delete (globalThis as { prisma?: unknown }).prisma;
    vi.resetModules();
    ({ prisma } = await import("./db"));
    ({ replanMotionDirection } = await import("./motion-direction-service"));
    await replanMotionDirection("film", { undo: true });
    const restored = await prisma.scene.findMany({ orderBy: { order: "asc" } });
    expect(
      restored.map((row) => [row.text, row.spokenText, row.layoutJson]),
    ).toEqual(before.map((row) => [row.text, row.spokenText, row.layoutJson]));
    const next = await replanMotionDirection("film", {
      preview: true,
      ambition: "clean",
    });
    if (next.state !== "planned") throw new Error("Expected proposal");
    await prisma.scene.update({
      where: { id: "a" },
      data: { text: "New source" },
    });
    await expect(
      replanMotionDirection("film", {
        ambition: "clean",
        expectedHash: next.sourceHash,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      replanMotionDirection("film", { undo: true }),
    ).rejects.toMatchObject({ status: 409 });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
