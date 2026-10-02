// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";
import { LocalDiskStore } from "./storage/local-disk";
const state = vi.hoisted(() => ({
  db: null as PrismaClient | null,
  directory: "",
}));
vi.mock("@/library/db", () => ({
  get prisma() {
    return state.db!;
  },
}));
vi.mock("@/library/storage", () => ({
  getAssetStore: () => new LocalDiskStore(path.join(state.directory, "media")),
}));
import { withProductionSignal } from "./production-cancellation";
import { generateTake } from "./take-service";
import { deleteSceneClip } from "./repositories/scene-clips";
import { generateAllSceneClips } from "./scene-voice-service";
import { pcmToWav } from "@/lib/wav";
import { GET, POST } from "@/app/api/scripts/[id]/captions/route";
const synth = vi.hoisted(() => vi.fn());
vi.mock("@/providers/voice/registry", () => ({
  getProvider: () => ({
    runtime: "server",
    label: "Fixture",
    isConfigured: () => true,
    maxConcurrency: 2,
    synth,
  }),
}));
vi.mock("@/server/auth", () => ({
  authorize: () => {},
  authorizeRead: () => {},
}));
function fixtureWav() {
  const pcm = Buffer.alloc(44100 * 2);
  for (let i = 0; i < 44100; i++)
    pcm.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 440) / 44100) * 4000),
      i * 2,
    );
  return pcmToWav(pcm);
}
let previous: string | undefined;
beforeEach(async () => {
  synth.mockReset();
  synth.mockImplementation(async ({ text }: { text: string }) => ({
    wav: fixtureWav(),
    sampleRate: 44100,
    words: text.split(" ").map((word, i) => ({
      text: word,
      startSeconds: i * 0.1,
      endSeconds: (i + 1) * 0.1,
    })),
  }));
  state.directory = mkdtempSync(path.join(tmpdir(), "reel-editor-jobs-"));
  const filename = path.join(state.directory, "jobs.db");
  const sqlite = new DatabaseSync(filename);
  for (const dir of readdirSync("prisma/migrations").sort()) {
    if (dir !== "migration_lock.toml")
      sqlite.exec(
        readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"),
      );
  }
  sqlite.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${filename}`;
  state.db = createPrismaClient();
  await state.db.project.create({ data: { id: "project", name: "Fixture" } });
  await state.db.script.create({
    data: { id: "script", name: "Fixture", projectId: "project" },
  });
  await state.db.scene.create({
    data: {
      id: "scene",
      scriptId: "script",
      order: 0,
      text: "Hello from the durable worker",
      templateId: "hf-typewriter",
    },
  });
});
afterEach(async () => {
  await state.db!.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(state.directory, { recursive: true, force: true });
});

const ctx = { params: Promise.resolve({ id: "script" }) };
const estimate = (takeId: string) =>
  POST(
    new Request("http://localhost/api/scripts/script/captions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "estimate", takeId }),
    }),
    ctx,
  );
it("persists provider timing through full-take cache reuse, reconnect and caption creation", async () => {
  const input = {
    scriptId: "script",
    providerId: "cartesia" as const,
    voiceId: "fixture",
  };
  await generateTake(input);
  const take = await generateTake(input);
  expect(synth).toHaveBeenCalledOnce();
  expect(take.timeline[0].words?.[0]).toEqual({
    text: "Hello",
    startFrame: 0,
    endFrame: 3,
  });
  await state.db!.$disconnect();
  state.db = createPrismaClient();
  const response = await estimate(take.id);
  expect(response.status).toBe(201);
  const { track } = await response.json();
  expect(track).toMatchObject({
    timingSource: "provider",
    sourceTakeId: take.id,
    sourceFps: 30,
  });
  expect(track.cues[0].words).toEqual(take.timeline[0].words);
  const download = await GET(
    new Request("http://localhost/api/scripts/script/captions?format=srt"),
    ctx,
  );
  expect(download.headers.get("x-caption-timing-source")).toBe("provider");
  expect(await download.text()).toContain("Hello from the durable worker");
});
it("retains scene clip words when assembling and rejects stale or incomplete provenance", async () => {
  const result = await generateAllSceneClips({
    scriptId: "script",
    providerId: "cartesia",
    voiceId: "fixture",
  });
  expect(result.take?.timeline[0].words).toHaveLength(5);
  await state.db!.scene.update({
    where: { id: "scene" },
    data: { spokenText: "Changed narration" },
  });
  const { track } = await (await estimate(result.take!.id)).json();
  expect(track.timingSource).toBe("estimated");
  expect(track.sourceTakeId).toBeNull();
  expect(track.cues[0].words).toEqual([]);
  const clip = await state.db!.sceneVoiceClip.findUniqueOrThrow({
    where: { id: result.clips[0].id },
  });
  const store = new LocalDiskStore(path.join(state.directory, "media"));
  expect(await store.exists(`${clip.audioPath}.words.json`)).toBe(true);
  await deleteSceneClip(clip.id);
  expect(await store.exists(`${clip.audioPath}.words.json`)).toBe(false);
});
it("keeps captions estimated when provider timing omits words or the frame rate changes", async () => {
  synth.mockResolvedValue({
    wav: fixtureWav(),
    sampleRate: 44100,
    words: [{ text: "Hello", startSeconds: 0, endSeconds: 0.2 }],
  });
  const take = await generateTake({
    scriptId: "script",
    providerId: "cartesia",
    voiceId: "fixture",
  });
  expect((await (await estimate(take.id)).json()).track.timingSource).toBe(
    "estimated",
  );
  await state.db!.script.update({ where: { id: "script" }, data: { fps: 24 } });
  expect((await (await estimate(take.id)).json()).track.timingSource).toBe(
    "estimated",
  );
});

it("does not publish provider output after cancellation even when the provider ignores its signal", async () => {
  const controller = new AbortController();
  synth.mockImplementation(async ({ signal }: { signal: AbortSignal }) => {
    expect(signal).toBe(controller.signal);
    controller.abort(new Error("Canceled"));
    return { wav: fixtureWav(), sampleRate: 44100 };
  });
  await expect(
    withProductionSignal(controller.signal, () =>
      generateTake({
        scriptId: "script",
        providerId: "cartesia",
        voiceId: "fixture",
      }),
    ),
  ).rejects.toThrow("Canceled");
  expect(await state.db!.voiceTake.count()).toBe(0);
  expect(await state.db!.sceneAudioBeat.count()).toBe(0);
});
it("rejects measured timing from a different frame rate or a partial take", async () => {
  const take = await generateTake({
    scriptId: "script",
    providerId: "cartesia",
    voiceId: "fixture",
  });
  await state.db!.script.update({ where: { id: "script" }, data: { fps: 24 } });
  expect((await (await estimate(take.id)).json()).track.timingSource).toBe(
    "estimated",
  );
  await state.db!.script.update({ where: { id: "script" }, data: { fps: 30 } });
  await state.db!.scene.create({
    data: {
      scriptId: "script",
      order: 1,
      text: "New ending",
      templateId: "hf-typewriter",
    },
  });
  const { track } = await (await estimate(take.id)).json();
  expect(track.timingSource).toBe("estimated");
  expect(
    track.cues.every((cue: { words: unknown[] }) => !cue.words.length),
  ).toBe(true);
});
