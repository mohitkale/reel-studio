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

it("makes a podcast from a storyboard: cast, script, intro and outro music, and a mastered episode job", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-podcast-sb-"));
  const filename = path.join(directory, "podcast.db");
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
  const created: string[] = [];
  try {
    const { producePodcastFromStoryboard } =
      await import("./podcast-storyboard-production");
    const { getPodcast } = await import("./repositories/podcasts");
    const made = await producePodcastFromStoryboard({
      version: 1,
      kind: "podcast",
      title: "Why the sky is blue",
      music: "calm-morning",
      speakers: [
        { id: "host", name: "Maya", voiceId: "af_heart" },
        { id: "guest", name: "Sam", voiceId: "am_michael" },
      ],
      turns: [
        { speaker: "host", text: "Welcome to the show, everyone." },
        { speaker: "guest", text: "Glad to be here, thanks for having me." },
        { speaker: "host", text: "So, why is the sky blue?" },
      ],
    } as never);
    expect(made).toMatchObject({
      speakers: 2,
      turns: 3,
      title: "Why the sky is blue",
    });

    const podcast = await getPodcast(made.podcastId);
    expect(podcast?.title).toBe("Why the sky is blue");
    expect(podcast?.presetId).toBe("two-host-discussion");
    expect(
      podcast?.characters.map((c) => [
        c.key,
        c.voiceId,
        c.providerId,
        c.gender,
      ]),
    ).toEqual([
      ["host", "af_heart", "kokoro-server", "female"],
      ["guest", "am_michael", "kokoro-server", "male"],
    ]);
    expect(podcast?.turns.map((t) => t.text)).toEqual([
      "Welcome to the show, everyone.",
      "Glad to be here, thanks for having me.",
      "So, why is the sky blue?",
    ]);
    expect(podcast?.introMusicAssetId).toBeTruthy();
    expect(podcast?.outroMusicAssetId).toBe(podcast?.introMusicAssetId);
    const asset = await prisma.asset.findUnique({
      where: { id: podcast!.introMusicAssetId! },
    });
    expect(asset).toMatchObject({ type: "audio", name: "Calm Morning" });
    created.push(asset!.path);

    // The job is the durable episode job, with the -16 LUFS master.
    const job = await prisma.productionJob.findUnique({
      where: { id: made.jobId },
    });
    expect(job?.kind).toBe("editor_voice");
    const input = JSON.parse(job!.inputSnapshot);
    expect(input).toMatchObject({
      operation: "podcast",
      resourceId: made.podcastId,
      masterLufs: -16,
    });

    // Music "none" attaches nothing.
    const quiet = await producePodcastFromStoryboard({
      version: 1,
      kind: "podcast",
      title: "Quiet",
      music: "none",
      speakers: [{ id: "solo", name: "Maya" }],
      turns: [
        { speaker: "solo", text: "A short solo note for you." },
        { speaker: "solo", text: "And a second one to close." },
      ],
    } as never);
    const solo = await getPodcast(quiet.podcastId);
    expect(solo?.presetId).toBe("solo-narration");
    expect(solo?.introMusicAssetId).toBeNull();
  } finally {
    await prisma.$disconnect();
    for (const key of created)
      await fs.rm(path.join(process.cwd(), "media", key), { force: true });
    await fs.rm(directory, { recursive: true, force: true });
  }
}, 30_000);
