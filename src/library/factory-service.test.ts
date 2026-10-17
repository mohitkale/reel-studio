// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pcmToWav, parseWav } from "@/lib/wav";
import { factoryRunRequestSchema } from "@/production/factory";
const storage = vi.hoisted(() => ({ files: new Map<string, Buffer>() }));
vi.mock("@/library/storage", () => ({
  getAssetStore: () => ({
    put: async (key: string, data: Buffer) => {
      storage.files.set(key, Buffer.from(data));
      return { key };
    },
    get: async (key: string) => {
      const data = storage.files.get(key);
      if (!data) throw new Error("Missing asset");
      return data;
    },
    exists: async (key: string) => storage.files.has(key),
    url: (key: string) => `/media/${key}`,
    open: async (key: string) => {
      const data = storage.files.get(key);
      if (!data) throw new Error("Missing asset");
      return {
        size: data.length,
        close: async () => {},
        stream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(data);
              controller.close();
            },
          }),
      };
    },
  }),
}));
const previous = process.env.DATABASE_URL;
afterEach(async () => {
  const state = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await state.prisma?.$disconnect();
  delete state.prisma;
  process.env.DATABASE_URL = previous;
  if (previous === undefined) delete process.env.DATABASE_URL;
  storage.files.clear();
  vi.resetModules();
});
it("migrates, pins profiles/packs and resumes immutable factory variants without replaying successful work", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-factory-")),
    filename = path.join(directory, "factory.db"),
    sql = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort()) {
    if (migration === "20261017000100_factory_workflows")
      sql.exec(
        "INSERT INTO Project(id,name,updatedAt) VALUES('legacy','Keep existing project',CURRENT_TIMESTAMP)",
      );
    sql.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  expect(
    sql.prepare("SELECT name FROM Project WHERE id='legacy'").get(),
  ).toMatchObject({ name: "Keep existing project" });
  expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  sql.close();
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db"),
    { createProjectFromPlan } = await import("./repositories/projects"),
    { getScript } = await import("./repositories/scripts"),
    { captureVideoSnapshot } = await import("./video-snapshot"),
    { createProductionRevision } = await import("./production-revision"),
    { createTake } = await import("./repositories/takes");
  const { publishFactoryProfile, submitFactoryRun, archiveFactoryProfile } =
      await import("./factory-service"),
    { ensureFactoryPack, verifyFactoryPack, factoryPackEntries } =
      await import("./factory-packs");
  const { cancelProductionBatch, retryProductionBatch } =
    await import("./production-batch-service");
  try {
    const created = await createProjectFromPlan(
      {
        projectName: "Factory fixture",
        scriptName: "Supplied source",
        styleId: "clean-story",
        energy: "calm",
        scenes: Array.from({ length: 4 }, (_, index) => ({
          templateId: "hf-statement",
          text: `Original complete display ${index}`,
          spokenText: `Original complete narration ${index}`,
          emphasis: [],
        })),
      },
      "landscape",
    );
    const script = (await getScript(created.scriptId))!;
    const pcm = Buffer.alloc(8 * 44100 * 2);
    for (let sample = 0; sample < 8 * 44100; sample++)
      pcm.writeInt16LE(Math.floor(sample / 44100) * 1000, sample * 2);
    storage.files.set("source.wav", pcmToWav(pcm));
    const take = await createTake({
      scriptId: script.id,
      label: "Measured fixture",
      providerId: "placeholder",
      voiceId: "silent",
      fps: script.fps,
      totalFrames: script.fps * 8,
      timeline: script.scenes.map((scene, index) => ({
        sceneId: scene.id,
        text: scene.spokenText ?? scene.text,
        startFrame: index * script.fps * 2,
        durationFrames: script.fps * 2,
        words: [
          {
            text: "Original",
            startFrame: index * 2 * script.fps + 5,
            endFrame: index * 2 * script.fps + 10,
          },
        ],
      })),
      audioPath: "source.wav",
      isPlaceholder: false,
    });
    await prisma.captionTrack.create({
      data: {
        scriptId: script.id,
        label: "Source captions",
        timingSource: "estimated",
        sourceTakeId: take.id,
        sourceFps: script.fps,
        cues: {
          create: [0, 1, 2].map((index) => ({
            order: index,
            startFrame: index * 2 * script.fps,
            endFrame: (index * 2 + 1) * script.fps,
            text: `Original complete narration ${index}`,
          })),
        },
      },
    });
    const source = await captureVideoSnapshot(script.id, take.id),
      revision = await createProductionRevision(source);
    const profile = await publishFactoryProfile({
      key: "fixture-series",
      version: 1,
      name: "Fixture series",
      sourceRevisionId: revision.id,
      orientations: ["landscape", "square"],
      quality: "draft",
    });
    await expect(
      publishFactoryProfile({
        key: "fixture-series",
        version: 1,
        name: "Overwrite immutable profile",
        sourceRevisionId: revision.id,
        orientations: ["square"],
        quality: "draft",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const request = factoryRunRequestSchema.parse({
      idempotencyKey: "factory-integration",
      sourceRevisionId: revision.id,
      profileId: profile.id,
      runMode: "approval",
      variants: [
        {
          kind: "aspect",
          key: "full",
          label: "Full story",
          orientation: "square",
        },
        {
          kind: "cutdown",
          key: "short",
          label: "Editorial selection",
          orientation: "portrait",
          sceneIds: [script.scenes[0].id, script.scenes[2].id],
        },
      ],
    });
    const args = {
      request,
      auth: { origin: "web" as const, token: null },
      serverBaseUrl: "http://127.0.0.1:3010",
    };
    let run = await submitFactoryRun(args);
    expect(run.batch?.state).toBe("awaiting_approval");
    expect(run.variants).toHaveLength(2);
    const childRows = await prisma.productionRevision.findMany({
      where: { source: "factory" },
    });
    expect(childRows).toHaveLength(2);
    const short = JSON.parse(
      childRows.find(
        (row) => JSON.parse(row.snapshotJson).factory.kind === "cutdown",
      )!.snapshotJson,
    ) as typeof source;
    expect(short.script.scenes.map((scene) => scene.text)).toEqual([
      source.script.scenes[0].text,
      source.script.scenes[2].text,
    ]);
    expect(short.take!.totalFrames).toBe(script.fps * 4);
    expect(short.take!.timeline[1].words![0].startFrame).toBe(
      script.fps * 2 + 5,
    );
    expect(short.script.captionTracks![0].cues.map((cue) => cue.text)).toEqual([
      "Original complete narration 0",
      "Original complete narration 2",
    ]);
    expect(short.script.captionTracks![0].cues[1].startFrame).toBe(
      script.fps * 2,
    );
    expect(short.factory?.sourceHash).toBe(revision.revisionHash);
    const audio = storage.files.get(short.take!.audioUrl.slice(7))!,
      info = parseWav(audio);
    expect(info.durationSeconds).toBe(4);
    expect(audio.readInt16LE(info.dataOffset)).toBe(0);
    expect(audio.readInt16LE(info.dataOffset + 44100 * 2 * 2)).toBe(4000);
    const pack = await ensureFactoryPack();
    expect(pack.digest).toBe(run.packDigest);
    expect(
      (await factoryPackEntries(pack.digest)).some(
        (entry) => entry.name === "gsap-NOTICE.txt",
      ),
    ).toBe(true);
    await prisma.scene.update({
      where: { id: script.scenes[0].id },
      data: { text: "Editable master changed after capture" },
    });
    await publishFactoryProfile({
      key: "fixture-series",
      version: 2,
      name: "Next series version",
      sourceRevisionId: revision.id,
      orientations: ["portrait"],
      quality: "high",
    });
    await archiveFactoryProfile(profile.id);
    const [completed, missing] = run.batch!.items;
    await prisma.productionJob.update({
      where: { id: completed.job!.id },
      data: { state: "succeeded" },
    });
    await prisma.productionJob.delete({ where: { id: missing.job!.id } });
    await prisma.factoryRun.update({
      where: { id: run.id },
      data: { batchId: null },
    });
    await prisma.$disconnect();
    run = await submitFactoryRun(args);
    expect(run.batch!.items[0].job!.id).toBe(completed.job!.id);
    expect(run.batch!.items[0].state).toBe("succeeded");
    expect(run.batch!.items[1].job).not.toBeNull();
    expect(
      await prisma.productionRevision.count({ where: { source: "factory" } }),
    ).toBe(2);
    expect(
      JSON.parse(
        (
          await prisma.productionJob.findUniqueOrThrow({
            where: { id: run.batch!.items[1].job!.id },
          })
        ).inputSnapshot,
      ).snapshot.script.scenes[0].text,
    ).toBe(source.script.scenes[0].text);
    await cancelProductionBatch(run.batchId!);
    await retryProductionBatch({
      id: run.batchId!,
      auth: args.auth,
      serverBaseUrl: args.serverBaseUrl,
    });
    expect(
      (
        await prisma.productionJob.findUniqueOrThrow({
          where: { id: run.batch!.items[1].job!.id },
        })
      ).state,
    ).toBe("awaiting_approval");
    const success = await prisma.productionJob.findUniqueOrThrow({
      where: { id: completed.job!.id },
    });
    expect(success.state).toBe("succeeded");
    await expect(
      submitFactoryRun({ ...args, request: { ...request, quality: "high" } }),
    ).rejects.toMatchObject({ status: 409 });
    const before = await prisma.factoryRun.count();
    await expect(
      submitFactoryRun({
        ...args,
        request: {
          ...request,
          idempotencyKey: "scoped-factory",
          profileId: undefined,
        },
        auth: {
          origin: "mcp",
          token: { kind: "named", record: { maxBatchSize: 1 } as never },
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.factoryRun.count()).toBe(before);
    const asset = pack.manifest.assets[0],
      key = `factory-packs/${pack.digest.slice(7)}/${asset.name}`,
      saved = storage.files.get(key)!;
    storage.files.set(key, Buffer.from("corrupt"));
    await expect(verifyFactoryPack(pack.digest)).rejects.toMatchObject({
      status: 409,
    });
    storage.files.set(key, saved);
    const { restoreProductionRevision } =
      await import("./restore-production-revision");
    const projectCount = await prisma.project.count();
    await expect(
      restoreProductionRevision({
        ...short,
        take: { ...short.take!, audioUrl: "/media/missing-factory.wav" },
      }),
    ).rejects.toThrow(/Missing asset/);
    expect(await prisma.project.count()).toBe(projectCount);
    const restored = await restoreProductionRevision(short),
      restoredScript = (await getScript(restored.scriptId))!;
    expect(restoredScript.brandTokens).toEqual(short.script.brandTokens);
    expect(restoredScript.factoryLineage).toEqual(short.factory);
    expect(restoredScript.width).toBe(short.script.width);
    expect(
      restoredScript.takes[0].timeline.map((beat) => beat.sceneId),
    ).toEqual(restoredScript.scenes.map((scene) => scene.id));
    expect(restoredScript.takes[0].audioUrl).not.toBe(short.take!.audioUrl);
    expect(restoredScript.captionTracks![0].sourceTakeId).toBe(
      restoredScript.takes[0].id,
    );
    expect(
      restoredScript.captionTracks![0].cues.map((cue) => cue.text),
    ).toEqual(short.script.captionTracks![0].cues.map((cue) => cue.text));
    const { assignBrandKit } = await import("./repositories/projects");
    await assignBrandKit(restored.projectId, null);
    const edited = (await getScript(restored.scriptId))!;
    expect(edited.factoryLineage).toEqual(short.factory);
    expect(
      JSON.parse(
        (
          await prisma.script.findUniqueOrThrow({
            where: { id: restored.scriptId },
          })
        ).brandOverrides!,
      ).frozenBrandTokens,
    ).toBeUndefined();
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
