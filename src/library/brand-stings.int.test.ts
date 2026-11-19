// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { pcmToWav } from "@/lib/wav";

const previousDatabaseUrl = process.env.DATABASE_URL;
vi.setConfig({ testTimeout: process.platform === "win32" ? 30_000 : 15_000 });

const TEST_FOLDER = "__brand-sting-test__";

afterEach(async () => {
  const g = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await g.prisma?.$disconnect();
  delete g.prisma;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  vi.resetModules();
  rmSync(path.join(process.cwd(), "media", TEST_FOLDER), {
    recursive: true,
    force: true,
  });
});

/** 1.2 seconds of a quiet tone, mono 16-bit at 16 kHz. */
function tone(): Buffer {
  const rate = 16000;
  const pcm = Buffer.alloc(Math.floor(rate * 1.2) * 2);
  for (let i = 0; i < pcm.length / 2; i++)
    pcm.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000),
      i * 2,
    );
  return pcmToWav(pcm, { sampleRate: rate, channels: 1, bitsPerSample: 16 });
}

async function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-brand-sting-"));
  const filename = path.join(directory, "stings.db");
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
  const { prisma } = await import("./db");
  mkdirSync(path.join(process.cwd(), "media", TEST_FOLDER), {
    recursive: true,
  });
  const key = `${TEST_FOLDER}/hello.wav`;
  writeFileSync(path.join(process.cwd(), "media", key), tone());
  const audio = await prisma.asset.create({
    data: { id: "sting-audio", type: "audio", path: key, name: "Hello" },
  });
  const image = await prisma.asset.create({
    data: {
      id: "not-audio",
      type: "image",
      path: `${TEST_FOLDER}/x.png`,
      name: "x",
    },
  });
  const kit = await prisma.brandKit.create({
    data: {
      name: "Branded",
      introStingAssetId: audio.id,
      outroStingAssetId: image.id,
    },
  });
  const project = await prisma.project.create({
    data: {
      name: "P",
      brandKitId: kit.id,
      scripts: {
        create: {
          id: "script-1",
          name: "S",
          scenes: {
            create: [
              {
                id: "scene-a",
                order: 0,
                templateId: "hf-statement",
                text: "One",
              },
              {
                id: "scene-b",
                order: 1,
                templateId: "hf-statement",
                text: "Two",
              },
            ],
          },
        },
      },
    },
  });
  return { prisma, project, kit };
}

describe("brand kit stings", () => {
  it("reads the kit's uploaded audio with its length, and ignores an asset that is not audio", async () => {
    await setup();
    const { resolveBrandStings } = await import("./brand-stings");
    const stings = await resolveBrandStings("script-1");
    expect(stings.intro?.url).toBe(`/media/${TEST_FOLDER}/hello.wav`);
    expect(stings.intro?.durationSeconds).toBeCloseTo(1.2, 1);
    expect(stings.outro).toBeUndefined();
  });

  it("puts the kit's sting at the start and the bundled chime at the end", async () => {
    const { prisma } = await setup();
    const { resolveBrandStings } = await import("./brand-stings");
    const { ensureStingCues } = await import("./sfx-service");
    await ensureStingCues("script-1", await resolveBrandStings("script-1"));
    const script = await prisma.script.findUnique({
      where: { id: "script-1" },
    });
    const cues = JSON.parse(script!.sfxJson!).cues as Array<
      Record<string, unknown>
    >;
    expect(cues[0]).toMatchObject({
      sceneId: "scene-a",
      sfxId: "custom",
      url: `/media/${TEST_FOLDER}/hello.wav`,
      locked: true,
    });
    expect(cues.at(-1)).toMatchObject({
      sceneId: "scene-b",
      sfxId: "sting-outro",
      fromEnd: true,
    });
    // Asking again replaces the stings instead of adding more.
    await ensureStingCues("script-1", await resolveBrandStings("script-1"));
    const again = JSON.parse(
      (await prisma.script.findUnique({ where: { id: "script-1" } }))!.sfxJson!,
    ).cues;
    expect(again).toHaveLength(2);
  });

  it("does nothing for a project with no brand kit", async () => {
    const { prisma, project } = await setup();
    await prisma.project.update({
      where: { id: project.id },
      data: { brandKitId: null },
    });
    const { resolveBrandStings } = await import("./brand-stings");
    expect(await resolveBrandStings("script-1")).toEqual({});
  });
});
