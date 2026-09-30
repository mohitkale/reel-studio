// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseSfxState } from "@/lib/sfx-cues";

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

it("preserves edited and muted cues through refresh, rejects stale edits, and restores current automatic direction in SQLite", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-sfx-edit-"));
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
    const { editSfxCue } = await import("./sfx-cue-edit-service");
    const { ensureSfxCues, setSfxEnabled } = await import("./sfx-service");
    await prisma.project.create({
      data: {
        id: "project",
        name: "Sound controls",
        scripts: {
          create: {
            id: "script",
            name: "Story",
            musicUrl: "/music/bed.wav",
            musicVolume: 18,
            scenes: {
              create: [0, 1].map((order) => ({
                id: `scene-${order}`,
                order,
                text: `Moment ${order}`,
                spokenText: `Narration ${order}`,
                templateId: "hf-kinetic-slam",
                layoutJson: JSON.stringify({
                  motion: { recipeId: "type-impact", version: "1.0.0" },
                }),
              })),
            },
          },
        },
      },
    });
    const read = () =>
      prisma.script.findUniqueOrThrow({
        where: { id: "script" },
        include: { scenes: { orderBy: { order: "asc" } } },
      });
    await ensureSfxCues("script");
    const before = await read();
    const original = parseSfxState(before.sfxJson).cues;
    expect(original).toHaveLength(2);
    expect(
      await editSfxCue("missing", {
        index: 0,
        expected: original[0],
        action: "automatic",
      }),
    ).toEqual({ state: "not_found" });
    expect(
      await editSfxCue("script", {
        index: 0,
        expected: original[0],
        action: "edit",
        changes: { offsetSeconds: 3 },
      }),
    ).toEqual({ state: "invalid_timing" });
    expect((await read()).sfxJson).toBe(before.sfxJson);
    expect(
      await editSfxCue("script", {
        index: 0,
        expected: original[0],
        action: "edit",
        changes: { volume: 0, offsetSeconds: -0.2, sfxId: "click" },
      }),
    ).toEqual({ state: "updated" });
    expect(
      await editSfxCue("script", {
        index: 0,
        expected: original[0],
        action: "edit",
        changes: { volume: 0.5 },
      }),
    ).toEqual({ state: "conflict" });
    await ensureSfxCues("script", { force: true });
    const after = await read();
    const edited = parseSfxState(after.sfxJson).cues;
    expect(edited).toHaveLength(2);
    expect(edited[0]).toMatchObject({
      sceneId: "scene-0",
      volume: 0,
      offsetSeconds: -0.2,
      sfxId: "click",
      locked: true,
      source: "manual",
    });
    expect(edited[1]).toEqual(original[1]);
    expect(after.scenes).toEqual(before.scenes);
    expect(after.musicUrl).toBe(before.musicUrl);
    expect(after.musicVolume).toBe(before.musicVolume);
    expect({
      ...after,
      sfxJson: before.sfxJson,
      updatedAt: before.updatedAt,
    }).toEqual(before);
    await setSfxEnabled("script", false);
    expect(
      await editSfxCue("script", {
        index: 0,
        expected: edited[0],
        action: "automatic",
      }),
    ).toEqual({ state: "updated" });
    const restored = await read();
    expect(restored.sfxEnabled).toBe(false);
    expect(parseSfxState(restored.sfxJson)).toEqual({
      enabled: false,
      cues: original,
    });
    await setSfxEnabled("script", true);
    await Promise.all([
      ensureSfxCues("script", { force: true }),
      editSfxCue("script", {
        index: 0,
        expected: original[0],
        action: "edit",
        changes: { volume: 0.25 },
      }),
    ]);
    const concurrent = parseSfxState((await read()).sfxJson).cues[0];
    expect(concurrent).toMatchObject({ source: "manual", volume: 0.25 });
    const competing = await Promise.all([
      editSfxCue("script", {
        index: 0,
        expected: concurrent,
        action: "edit",
        changes: { volume: 0.3 },
      }),
      editSfxCue("script", {
        index: 0,
        expected: concurrent,
        action: "edit",
        changes: { volume: 0.4 },
      }),
    ]);
    expect(competing.map((result) => result.state).sort()).toEqual([
      "conflict",
      "updated",
    ]);
    await editSfxCue("script", {
      index: 0,
      expected: parseSfxState((await read()).sfxJson).cues[0],
      action: "automatic",
    });
    // A quieter new visual direction removes its old hit on explicit reset.
    await prisma.scene.update({
      where: { id: "scene-0" },
      data: {
        layoutJson: JSON.stringify({
          motion: { recipeId: "type-editorial", version: "1.0.0" },
        }),
      },
    });
    await editSfxCue("script", {
      index: 0,
      expected: original[0],
      action: "automatic",
    });
    expect(parseSfxState((await read()).sfxJson).cues).toEqual([original[1]]);
    // Returning one cue to automatic never removes another authored cue in that scene.
    const legacy = {
      sceneId: "scene-1",
      sfxId: "click" as const,
      volume: 0.2,
      offsetSeconds: 0.5,
    };
    await prisma.script.update({
      where: { id: "script" },
      data: {
        sfxJson: JSON.stringify({
          enabled: false,
          cues: [original[1], legacy],
        }),
      },
    });
    await editSfxCue("script", {
      index: 0,
      expected: original[1],
      action: "automatic",
    });
    expect(parseSfxState((await read()).sfxJson).cues).toEqual([legacy]);
    expect(
      await editSfxCue("script", {
        index: 0,
        expected: legacy,
        action: "edit",
        changes: { offsetSeconds: -0.1 },
      }),
    ).toEqual({ state: "invalid_timing" });
  } finally {
    db.close();
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15_000);
