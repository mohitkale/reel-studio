// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";
import { pcmToWav, parseWav } from "@/lib/wav";
import {
  saveAudioEdit,
  getAudioEdit,
  commitAudioEdit,
  editPcmAudio,
} from "./audio-edit-service";
const memory = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/library/storage", () => ({
  getAssetStore: () => ({
    open: async (key: string) => {
      const bytes = memory.get(key);
      if (!bytes) throw new Error("Missing bytes");
      return {
        size: bytes.length,
        stream: () =>
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(bytes));
              c.close();
            },
          }),
        close: async () => {},
      };
    },
    put: async (key: string, bytes: Buffer) => {
      memory.set(key, bytes);
      return { key };
    },
    delete: async (key: string) => {
      memory.delete(key);
    },
    url: (key: string) => `/media/${key}`,
  }),
}));
let previous: string | undefined;
let directory: string,
  client: ReturnType<typeof createPrismaClient>,
  takeId: string;
const plan = {
  version: 1 as const,
  ranges: [{ start: 0.2, end: 0.6 }],
  gains: { Narrator: 0.5 },
  cleanup: false,
};
beforeEach(async () => {
  directory = mkdtempSync(path.join(os.tmpdir(), "studio-audio-"));
  const filename = path.join(directory, "test.db"),
    db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations").sort())
    if (migration.startsWith("20"))
      db.exec(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
  db.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${filename}`;
  client = createPrismaClient();
  const project = await client.project.create({ data: { name: "Test" } }),
    script = await client.script.create({
      data: { projectId: project.id, name: "Voice" },
    }),
    scene = await client.scene.create({
      data: {
        scriptId: script.id,
        order: 0,
        text: "Voice",
        templateId: "hf-statement",
      },
    });
  const pcm = Buffer.alloc(44100 * 2);
  for (let i = 0; i < 44100; i++) pcm.writeInt16LE(10000, i * 2);
  memory.set("source.wav", pcmToWav(pcm));
  takeId = (
    await client.voiceTake.create({
      data: {
        scriptId: script.id,
        providerId: "kokoro-server",
        voiceId: "af_heart",
        totalFrames: 30,
        timingJson: JSON.stringify([
          {
            sceneId: scene.id,
            startFrame: 0,
            durationFrames: 30,
            text: "Voice",
          },
        ]),
        audioPath: "source.wav",
      },
    })
  ).id;
});
afterEach(async () => {
  await client?.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(directory, { recursive: true, force: true });
  memory.clear();
});
it("cuts samples, applies gain/fades and preserves original bytes", () => {
  const original = Buffer.from(memory.get("source.wav")!);
  const result = editPcmAudio(original, plan, [
    { id: "scene", text: "Voice", speaker: "Narrator", start: 0, end: 1 },
  ]);
  const info = parseWav(result);
  expect(info.durationSeconds).toBeCloseTo(0.4, 5);
  expect(result.readInt16LE(info.dataOffset + 2000)).toBe(5000);
  expect(result.readInt16LE(info.dataOffset)).toBe(0);
  expect(original).toEqual(memory.get("source.wav"));
});
it("persists history and rejects a stale browser revision", async () => {
  const saved = await saveAudioEdit(
    {
      kind: "voiceover",
      takeId,
      history: [plan],
      cursor: 0,
      expectedRevision: 0,
    },
    client,
  );
  expect((await getAudioEdit("voiceover", takeId, client))?.history).toEqual([
    plan,
  ]);
  await expect(
    saveAudioEdit(
      {
        kind: "voiceover",
        takeId,
        history: [plan],
        cursor: 0,
        expectedRevision: 0,
      },
      client,
    ),
  ).rejects.toThrow("another session");
  expect(saved.revision).toBe(1);
});
it("saves an edited take once and keeps the source playable", async () => {
  const saved = await saveAudioEdit(
    {
      kind: "voiceover",
      takeId,
      history: [plan],
      cursor: 0,
      expectedRevision: 0,
    },
    client,
  );
  const first = await commitAudioEdit(
    "voiceover",
    takeId,
    saved.revision,
    client,
  );
  expect(
    await commitAudioEdit("voiceover", takeId, saved.revision, client),
  ).toEqual(first);
  expect(await client.voiceTake.count()).toBe(2);
  const edited = await client.voiceTake.findUniqueOrThrow({
    where: { id: first.takeId },
  });
  expect(edited).toMatchObject({ source: "edited", totalFrames: 12 });
  expect(parseWav(memory.get(edited.audioPath)!).durationSeconds).toBeCloseTo(
    0.4,
    4,
  );
  expect(memory.has("source.wav")).toBe(true);
  await client.voiceTake.delete({ where: { id: first.takeId } });
  const replacement = await commitAudioEdit(
    "voiceover",
    takeId,
    saved.revision,
    client,
  );
  expect(replacement.takeId).not.toBe(first.takeId);
  expect(await client.voiceTake.count()).toBe(2);
});
it("rejects out-of-bounds edits before creating a take", async () => {
  await expect(
    saveAudioEdit(
      {
        kind: "voiceover",
        takeId,
        history: [{ ...plan, ranges: [{ start: 0, end: 2 }] }],
        cursor: 0,
        expectedRevision: 0,
      },
      client,
    ),
  ).rejects.toThrow("source audio");
  expect(await client.audioEditSession.count()).toBe(0);
});
