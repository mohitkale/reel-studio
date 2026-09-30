// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  promises as fs,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pcmToWav } from "@/lib/wav";

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
it("analyzes local audio once, saves safe manual edits and freezes them in snapshots", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-music-map-test-"));
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
  await fs.mkdir("media", { recursive: true });
  const audioDirectory = await fs.mkdtemp(
    path.resolve("media/music-map-test-"),
  );
  const audio = path.join(audioDirectory, "pulse.wav");
  const musicUrl = `/media/${path.basename(audioDirectory)}/pulse.wav`;
  const pcm = Buffer.alloc(8000 * 8 * 2);
  for (let time = 0.12; time < 8; time += 0.5)
    for (
      let sample = Math.round(time * 8000);
      sample < Math.round(time * 8000) + 80;
      sample++
    )
      pcm.writeInt16LE(18000, sample * 2);
  await fs.writeFile(audio, pcmToWav(pcm, { sampleRate: 8000 }));
  const { prisma } = await import("./db");
  try {
    const { analyzeMusicMap, editMusicMap } =
      await import("./music-map-service");
    const { getScript, updateScript } = await import("./repositories/scripts");
    const { captureVideoSnapshot } = await import("./video-snapshot");
    await prisma.project.create({
      data: {
        id: "project",
        name: "Music review",
        scripts: {
          create: {
            id: "script",
            name: "Story",
            musicUrl,
            brandOverrides: JSON.stringify({
              styleId: "clean-story",
              customBrandField: "preserved",
            }),
            scenes: {
              create: {
                id: "scene",
                order: 0,
                templateId: "hf-statement",
                text: "Original copy",
              },
            },
          },
        },
      },
    });
    const first = await analyzeMusicMap("script", "http://localhost:3000");
    expect(first.bpm).toBeCloseTo(120, 0);
    expect(first.confidence).toBeGreaterThan(0.8);
    const edited = await editMusicMap(
      "script",
      {
        expected: first,
        changes: { bpm: 60, disabledBeats: [1], dropSeconds: 2 },
      },
      "http://localhost:3000",
    );
    expect(edited.method).toBe("manual");
    expect(await analyzeMusicMap("script", "http://localhost:3000")).toEqual(
      edited,
    );
    expect((await getScript("script"))?.musicMap).toEqual(edited);
    await updateScript("script", { audioMastering: "balanced" });
    await updateScript("script", { energy: "calm" });
    expect((await getScript("script"))?.audioMastering).toBe("balanced");
    expect((await captureVideoSnapshot("script")).script.audioMastering).toBe(
      "balanced",
    );
    const { restoreProductionRevision } =
      await import("./restore-production-revision");
    const restored = await restoreProductionRevision(
      await captureVideoSnapshot("script"),
    );
    expect((await getScript(restored.scriptId))?.audioMastering).toBe(
      "balanced",
    );
    expect((await captureVideoSnapshot("script")).script.musicMap).toEqual(
      edited,
    );
    const row = await prisma.script.findUniqueOrThrow({
      where: { id: "script" },
    });
    expect(JSON.parse(row.brandOverrides!)).toMatchObject({
      styleId: "clean-story",
      customBrandField: "preserved",
    });
    expect(
      (await prisma.scene.findUniqueOrThrow({ where: { id: "scene" } })).text,
    ).toBe("Original copy");
    await expect(
      editMusicMap(
        "script",
        { expected: first, changes: { dropSeconds: 1 } },
        "http://localhost:3000",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      editMusicMap(
        "script",
        { expected: edited, changes: { offsetSeconds: 1.1 } },
        "http://localhost:3000",
      ),
    ).rejects.toMatchObject({ status: 400 });
    await fs.writeFile(
      audio,
      pcmToWav(Buffer.alloc(pcm.length), { sampleRate: 8000 }),
    );
    await expect(
      editMusicMap(
        "script",
        { expected: edited, changes: {} },
        "http://localhost:3000",
      ),
    ).rejects.toMatchObject({ status: 409 });
    const refreshed = await analyzeMusicMap("script", "http://localhost:3000");
    expect(refreshed.sourceHash).not.toBe(first.sourceHash);
    expect(refreshed.confidence).toBe(0);
    expect(refreshed.method).toBe("manual");
    await prisma.script.update({
      where: { id: "script" },
      data: { musicUrl: "/music/different.wav" },
    });
    expect((await getScript("script"))?.musicMap).toBeUndefined();
    await expect(
      editMusicMap(
        "script",
        { expected: refreshed, changes: {} },
        "http://localhost:3000",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await prisma.script.update({
      where: { id: "script" },
      data: { musicUrl: "https://example.test/track.mp3" },
    });
    await expect(
      analyzeMusicMap("script", "http://localhost:3000"),
    ).rejects.toThrow("locally");
  } finally {
    await prisma.$disconnect();
    await fs.rm(directory, { recursive: true, force: true });
    await fs.rm(audioDirectory, { recursive: true, force: true });
  }
});
