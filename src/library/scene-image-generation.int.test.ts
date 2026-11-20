// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ImageProvider } from "@/providers/image/types";

const previousDatabaseUrl = process.env.DATABASE_URL;

afterEach(async () => {
  const g = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await g.prisma?.$disconnect();
  delete g.prisma;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  vi.resetModules();
  vi.doUnmock("@/library/storage");
});

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

function fakeProvider(failOn?: string) {
  const calls: string[] = [];
  const provider: ImageProvider = {
    id: "comfyui",
    label: "Fake",
    model: "fake.safetensors",
    test: async () => ({ ok: true, message: "ok" }),
    generate: async (input) => {
      calls.push(input.prompt);
      if (input.prompt === failOn) throw new Error("out of memory");
      return { bytes: PNG, mime: "image/png" };
    },
  };
  return { provider, calls };
}

async function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-image-gen-"));
  const filename = path.join(directory, "images.db");
  const db = new DatabaseSync(filename);
  try {
    for (const migration of readdirSync("prisma/migrations")
      .filter((n) => !n.endsWith(".toml"))
      .sort())
      db.exec(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
  } finally {
    db.close();
  }
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const stored = new Map<string, Buffer>();
  vi.doMock("@/library/storage", () => ({
    getAssetStore: () => ({
      put: async (key: string, bytes: Buffer) => void stored.set(key, bytes),
      url: (key: string) => `/media/${key}`,
    }),
  }));
  const { generateSceneImages } = await import("./scene-image-generation");
  const { prisma } = await import("./db");
  return { generateSceneImages, prisma, stored };
}

describe("generating scene images", () => {
  it("falls back with a note, and no error, when nothing is configured", async () => {
    const { generateSceneImages } = await setup();
    const result = await generateSceneImages({
      prompts: [undefined, "a lighthouse", "a harbour"],
      orientation: "portrait",
      videoSeed: "v",
      provider: null,
    });
    expect(result.assetIds).toEqual([undefined, undefined, undefined]);
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0]).toContain("scenes.1");
    expect(result.notes[0]).toContain("no image generator");
  });

  it("makes each picture once, lists it in the library, and reuses it on a repeat", async () => {
    const { generateSceneImages, prisma, stored } = await setup();
    const { provider, calls } = fakeProvider();
    const args = {
      prompts: ["a lighthouse", undefined, "a harbour"],
      orientation: "portrait" as const,
      themeId: "cinematic",
      videoSeed: "video-1",
      provider,
    };
    const first = await generateSceneImages(args);
    expect(first.generated).toBe(2);
    expect(first.assetIds[0]).toBeTruthy();
    expect(first.assetIds[1]).toBeUndefined();
    expect(calls).toEqual(["a lighthouse", "a harbour"]);
    expect(stored.size).toBe(2);
    const assets = await prisma.asset.findMany();
    expect(assets).toHaveLength(2);
    expect(
      assets.every(
        (a) => a.type === "image" && a.path.startsWith("assets/generated/"),
      ),
    ).toBe(true);
    expect(JSON.parse(assets[0]!.meta!)).toMatchObject({
      generated: true,
      provider: "comfyui",
    });

    const again = await generateSceneImages(args);
    expect(again.cached).toBe(2);
    expect(again.generated).toBe(0);
    expect(again.assetIds).toEqual(first.assetIds);
    expect(calls).toHaveLength(2);

    // A different seed (another video) makes new pictures.
    const other = await generateSceneImages({ ...args, videoSeed: "video-2" });
    expect(other.generated).toBe(2);
    expect(calls).toHaveLength(4);
  });

  it("keeps going and notes the scene when one picture fails", async () => {
    const { generateSceneImages } = await setup();
    const { provider } = fakeProvider("a harbour");
    const result = await generateSceneImages({
      prompts: ["a lighthouse", "a harbour"],
      orientation: "landscape",
      videoSeed: "v",
      provider,
    });
    expect(result.assetIds[0]).toBeTruthy();
    expect(result.assetIds[1]).toBeUndefined();
    expect(result.notes[0]).toContain("scenes.1");
    expect(result.notes[0]).toContain("out of memory");
  });
});
