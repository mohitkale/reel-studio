/** Opt-in M6 acceptance. Active-app examples, existing local graphics and silent WAV timing only. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../src/library/db";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { getScript } from "../src/library/repositories/scripts";
import { createTake } from "../src/library/repositories/takes";
import { captureVideoSnapshot } from "../src/library/video-snapshot";
import { createProductionRevision } from "../src/library/production-revision";
import {
  publishFactoryProfile,
  submitFactoryRun,
  getFactoryRun,
} from "../src/library/factory-service";
import {
  cancelProductionBatch,
  retryProductionBatch,
} from "../src/library/production-batch-service";
import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";
import { getAssetStore } from "../src/library/storage";
import { makeSilentWav } from "../src/lib/wav";
import { factoryRunRequestSchema } from "../src/production/factory";
import { factoryPackEntries } from "../src/library/factory-packs";
import {
  createProductionBundleStream,
  productionBatchBundleEntries,
} from "../src/library/production-bundle";
import { getProductionBatch } from "../src/library/repositories/production-batches";
import { filmCanonicalJson } from "../src/production/film-plan";
const root = ".artifacts/adaptive-m6",
  execute = promisify(execFile),
  baseUrl = process.env.REEL_VERIFY_BASE_URL ?? "http://127.0.0.1:3010",
  auth = { origin: "web" as const, token: null };
const recordSchema = z.object({
  scriptId: z.string(),
  sourceRevisionId: z.string(),
  profileId: z.string(),
  runId: z.string(),
  cancelVerified: z.boolean().default(false),
  restoredScriptId:z.string().optional(),
});
type FactoryRun = NonNullable<Awaited<ReturnType<typeof getFactoryRun>>>;
const stop = new AbortController();
process.once("SIGINT", () => stop.abort());
process.once("SIGTERM", () => stop.abort());
async function archive(
  filename: string,
  entries: Parameters<typeof createProductionBundleStream>[0],
) {
  const chunks: Buffer[] = [];
  for await (const chunk of createProductionBundleStream(entries))
    chunks.push(chunk as Buffer);
  await writeFile(filename, Buffer.concat(chunks));
}
async function main() {
  await mkdir(root, { recursive: true });
  let record: z.infer<typeof recordSchema> | undefined;
  try {
    record = recordSchema.parse(
      JSON.parse(await readFile(`${root}/example.json`, "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!record) {
    const created = await createProjectFromPlan(
      {
        projectName: "M6 · Factory workflow",
        scriptName: "M6 · Master process explainer",
        styleId: "clean-story",
        energy: "calm",
        scenes: [
          {
            templateId: "hf-list",
            text: "Capture, then Review, then Publish.",
            spokenText:
              "Capture supplied content, review the source, then publish the reviewed version.",
            items: ["Capture", "Review", "Publish"],
            emphasis: [],
          },
          {
            templateId: "hf-statement",
            text: "Review preserves supplied facts.",
            spokenText:
              "Review keeps the supplied facts and complete narration intact.",
            emphasis: [],
          },
          {
            templateId: "hf-list",
            text: "Compare a draft and a reviewed version.",
            spokenText:
              "A draft comes before review. A reviewed version comes after review.",
            items: ["Draft", "Reviewed version"],
            emphasis: [],
          },
          {
            templateId: "hf-list",
            text: "Return to Capture, Review and Publish.",
            spokenText:
              "Return to the same named stages with the same saved identities.",
            items: ["Capture", "Review", "Publish"],
            emphasis: [],
          },
          {
            templateId: "hf-statement",
            text: "A format change preserves the story.",
            spokenText:
              "An aspect adaptation changes the layout while keeping every source scene.",
            emphasis: [],
          },
          {
            templateId: "hf-statement",
            text: "A cutdown selects complete scenes.",
            spokenText:
              "A cutdown uses an explicit selection and keeps its parent revision as lineage.",
            emphasis: [],
          },
        ],
      },
      "landscape",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        visualAmbition: "expressive",
        roles: [
          "diagram",
          "explanation",
          "comparison",
          "diagram",
          "summary",
          "summary",
        ],
        mediaPreferences: Array(6).fill("none"),
      },
    );
    const script = (await getScript(created.scriptId))!,
      audioPath = "fixtures/m6-timing.wav";
    await getAssetStore().put(audioPath, makeSilentWav(18));
    const take = await createTake({
      scriptId: script.id,
      label: "M6 · Silent timing fixture",
      providerId: "placeholder",
      voiceId: "silent",
      fps: script.fps,
      totalFrames: 18 * script.fps,
      timeline: script.scenes.map((scene, index) => ({
        sceneId: scene.id,
        text: scene.spokenText ?? scene.text,
        startFrame: index * 3 * script.fps,
        durationFrames: 3 * script.fps,
      })),
      audioPath,
      isPlaceholder: true,
    });
    const source = await captureVideoSnapshot(script.id, take.id),
      revision = await createProductionRevision(source),
      profile = await publishFactoryProfile({
        key: "m6-process-series",
        version: 1,
        name: "M6 process series",
        sourceRevisionId: revision.id,
        orientations: ["portrait", "landscape", "square"],
        quality: "draft",
      });
    const run = await submitFactoryRun({
      request: factoryRunRequestSchema.parse({
        idempotencyKey: `m6-fixture:${revision.id}`,
        sourceRevisionId: revision.id,
        profileId: profile.id,
        runMode: "automatic",
        variants: [
          ...(["portrait", "landscape", "square"] as const).map(
            (orientation) => ({
              key: `full-${orientation}`,
              label: `M6 · Full story · ${orientation}`,
              kind: "aspect",
              orientation,
            }),
          ),
          {
            key: "cutdown",
            label: "M6 · Selected process cutdown",
            kind: "cutdown",
            orientation: "portrait",
            sceneIds: [script.scenes[0].id, script.scenes[3].id],
          },
        ],
      }),
      auth,
      serverBaseUrl: baseUrl,
    });
    record = {
      scriptId: script.id,
      sourceRevisionId: revision.id,
      profileId: profile.id,
      runId: run.id,
      cancelVerified: false,
    };
    await writeFile(`${root}/example.json`, JSON.stringify(record, null, 2));
  }
  let run: FactoryRun = (await getFactoryRun(record.runId))!;
  assert.ok(run.batchId);
  const batchId = run.batchId;
  for (let attempts = 0; attempts < 10; attempts++) {
    stop.signal.throwIfAborted();
    run = (await getFactoryRun(record.runId))!;
    const others = await prisma.productionJob.count({
      where: {
        state: { in: ["queued", "running"] },
        OR: [
          { batchItemId: null },
          { batchItem: { batchId: { not: batchId } } },
        ],
      },
    });
    assert.equal(
      others,
      0,
      "Other active work exists; do not claim unrelated jobs",
    );
    const failed = run.batch!.items.filter((item) => item.state === "failed");
    assert.equal(failed.length, 0, JSON.stringify(failed));
    if (run.batch!.items.every((item) => item.state === "succeeded")) break;
    if (!record.cancelVerified && run.batch!.succeededItems === 1) {
      const succeeded = run.batch!.items.find(
          (item) => item.state === "succeeded",
        )!,
        jobId = succeeded.job!.id;
      await cancelProductionBatch(batchId);
      const canceled: FactoryRun = (await getFactoryRun(record.runId))!;
      assert.equal(
        canceled.batch!.items.filter((item) => item.state === "canceled")
          .length,
        3,
      );
      assert.equal(canceled.batch!.succeededItems, 1);
      await prisma.$disconnect();
      await retryProductionBatch({ id: batchId, auth, serverBaseUrl: baseUrl });
      const resumed: FactoryRun = (await getFactoryRun(record.runId))!;
      assert.equal(
        resumed.batch!.items.find((item) => item.job?.id === jobId)?.state,
        "succeeded",
      );
      record.cancelVerified = true;
      await writeFile(`${root}/example.json`, JSON.stringify(record, null, 2));
      console.log(
        "M6 batch cancellation/reconnect/resume passed; completed output retained.",
      );
    }
    const outcome = await runProductionWorkerOnce({
      workerId: `m6-fixture:${attempts}`,
      signal: stop.signal,
      leaseMs: 120000,
      execute: executeProductionJob,
    });
    assert.equal(
      outcome,
      "succeeded",
      JSON.stringify((await getFactoryRun(record.runId))!.batch!.items),
    );
  }
  run = (await getFactoryRun(record.runId))!;
  assert.equal(run.batch!.state, "succeeded");
  assert.equal(record.cancelVerified, true);
  const stored = (await getProductionBatch(batchId))!;
  const outputs = [];
  for (const item of stored.items) {
    assert.equal(item.job!.outputs.length, 1);
    const output = item.job!.outputs[0],
      filename = path.isAbsolute(output.path)
        ? output.path
        : path.resolve("media", output.path),
      { stdout } = await execute("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,nb_frames,r_frame_rate,duration",
        "-of",
        "json",
        filename,
      ]),
      metadata = JSON.parse(stdout) as {
        streams: Array<{
          width: number;
          height: number;
          nb_frames: string;
          duration: string;
        }>;
      },
      video = metadata.streams[0],
      short = item.label!.includes("cutdown"),
      seconds = short ? 6 : 18;
    assert.equal(Number(video.nb_frames), seconds * 30);
    assert.equal(Number(video.duration), seconds);
    const dims =
      item.orientation === "portrait"
        ? [1080, 1920]
        : item.orientation === "landscape"
          ? [1920, 1080]
          : [1080, 1080];
    assert.deepEqual([video.width, video.height], dims);
    outputs.push({
      label: item.label,
      orientation: item.orientation,
      renderId: JSON.parse(item.job!.inputSnapshot).renderId,
      outputPath: output.path,
      checksum: output.checksum,
      metadata: video,
    });
  }
  const frozenRows = await prisma.productionRevision.findMany({
    where: { id: { in: run.variants.map((variant) => variant.revisionId) } },
  });
  const before = filmCanonicalJson(frozenRows.map((row) => row.snapshotJson));
  await publishFactoryProfile({
    key: "m6-process-series",
    version: 2,
    name: "M6 process series · square defaults",
    sourceRevisionId: record.sourceRevisionId,
    orientations: ["square"],
    quality: "standard",
  });
  const after = await prisma.productionRevision.findMany({
    where: { id: { in: run.variants.map((variant) => variant.revisionId) } },
  });
  assert.equal(filmCanonicalJson(after.map((row) => row.snapshotJson)), before);
  await archive(
    `${root}/adaptive-core.tar.gz`,
    await factoryPackEntries(run.packDigest),
  );
  await archive(
    `${root}/outputs.tar.gz`,
    await productionBatchBundleEntries(stored),
  );
  if (!record.restoredScriptId) {
    const cut = after.find(
      (row) => JSON.parse(row.snapshotJson).factory.kind === "cutdown",
    )!;
    const { restoreProductionRevision } =
      await import("../src/library/restore-production-revision");
    const restored = await restoreProductionRevision(
      JSON.parse(cut.snapshotJson),
    );
    await prisma.project.update({
      where: { id: restored.projectId },
      data: { name: "M6 · Editable cutdown" },
    });
    await prisma.script.update({
      where: { id: restored.scriptId },
      data: { name: "M6 · Editable process cutdown" },
    });
    const editable = (await getScript(restored.scriptId))!;
    assert.equal(editable.scenes.length, 2);
    assert.equal(editable.takes[0].totalFrames, 6 * editable.fps);
    assert.ok(editable.factoryLineage);
    record.restoredScriptId = restored.scriptId;
    await writeFile(`${root}/example.json`, JSON.stringify(record, null, 2));
  }
  await writeFile(
    `${root}/verified.json`,
    JSON.stringify(
      { record, run, outputs, packDigest: run.packDigest },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
  console.log(`M6 actual factory acceptance passed: ${root}/verified.json`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
