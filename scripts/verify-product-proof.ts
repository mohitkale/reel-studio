/** Opt-in active-app acceptance: actual UI fixtures, three formats, no paid calls. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../src/library/db";
import { getAssetStore } from "../src/library/storage";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { getScript } from "../src/library/repositories/scripts";
import {
  controlProductProof,
  readProductProof,
} from "../src/library/product-proof-service";
import { scenePlanSchema } from "../src/providers/ai/types";
import { captureVideoSnapshot } from "../src/library/video-snapshot";
import { submitProduction } from "../src/library/production-service";
import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";
import { ORIENTATIONS } from "../src/lib/orientation";
const run = promisify(execFile),
  sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function sourceAssets() {
  const store = getAssetStore(),
    editor = await readFile("tests/fixtures/product-proof/editor.png"),
    evidence = await readFile("tests/fixtures/product-proof/evidence.png");
  const imageKey = `qa/product-proof/editor-${sha(editor).slice(0, 16)}.png`,
    videoKey = `qa/product-proof/sequence-v2-${sha(Buffer.concat([editor, evidence])).slice(0, 16)}.mp4`;
  await store.put(imageKey, editor);
  if (!(await store.exists(videoKey))) {
    const directory = await mkdtemp(path.join(tmpdir(), "reel-proof-video-"));
    try {
      await writeFile(path.join(directory, "editor.png"), editor);
      await writeFile(path.join(directory, "evidence.png"), evidence);
      const video = path.join(directory, "proof.mp4");
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-loop",
          "1",
          "-framerate",
          "12",
          "-t",
          "10",
          "-i",
          path.join(directory, "editor.png"),
          "-loop",
          "1",
          "-framerate",
          "12",
          "-t",
          "10",
          "-i",
          path.join(directory, "evidence.png"),
          "-f",
          "lavfi",
          "-t",
          "20",
          "-i",
          "anullsrc=sample_rate=48000:channel_layout=stereo",
          "-filter_complex",
          "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]",
          "-map",
          "[v]",
          "-map",
          "2:a",
          "-t",
          "20",
          "-c:v",
          "libx264",
          "-crf",
          "18",
          "-c:a",
          "aac",
          "-y",
          video,
        ],
        { timeout: 30000, maxBuffer: 1024 * 1024 },
      );
      await store.put(videoKey, await readFile(video));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  const image =
    (await prisma.asset.findFirst({ where: { path: imageKey } })) ??
    (await prisma.asset.create({
      data: {
        type: "image",
        path: imageKey,
        name: "M5 supplied UI · Editorial review",
        meta: JSON.stringify({
          fixture: "Actual app screenshot with synthetic data",
          sourceLicense: "Repository license",
        }),
      },
    }));
  const video =
    (await prisma.asset.findFirst({ where: { path: videoKey } })) ??
    (await prisma.asset.create({
      data: {
        type: "video",
        path: videoKey,
        name: "M5 supplied UI · Screenshot-sequence video",
        meta: JSON.stringify({
          fixture: "Actual app screenshot sequence",
          durationSeconds: 20,
          sourceLicense: "Repository license",
        }),
      },
    }));
  return { image, video };
}
async function main() {
  assert.equal(
    await prisma.productionJob.count({
      where: { state: { in: ["queued", "running"] } },
    }),
    0,
    "Finish active jobs first",
  );
  const { image, video } = await sourceAssets();
  const results = [];
  for (const orientation of ORIENTATIONS) {
    const plan = scenePlanSchema.parse({
      projectName: `M5 Proof · Real supplied UI · ${orientation}`,
      scriptName: `Supplied product proof · ${orientation}`,
      scenes: [
        {
          templateId: "hf-statement",
          text: "Review linked sources.",
          spokenText:
            "Review the actual source excerpts and keep uncertainty visible before publishing.",
          emphasis: [],
        },
        {
          templateId: "hf-statement",
          text: "Keep the approved copy.",
          spokenText:
            "Replace a supplied visual while keeping the approved narration and source links intact.",
          emphasis: [],
        },
      ],
    });
    const created = await createProjectFromPlan(
      plan,
      orientation,
      [],
      "hyperframes",
      { styleId: "clean-story", energy: "calm" },
      {
        preset: { id: "product-launch", version: "1.0.0" },
        roles: ["feature", "feature"],
        mediaPreferences: ["none", "none"],
      },
    );
    const initial = (await getScript(created.scriptId))!;
    const copy = initial.scenes.map((scene) => ({
      text: scene.text,
      spokenText: scene.spokenText,
    }));
    const features = [
      {
        id: "source-review",
        label: "Source-linked writing review",
        subjectLabel: "Reel Studio",
        sceneIds: [initial.scenes[0].id],
        assets: [{ assetId: image.id, startSeconds: 0 }],
      },
      {
        id: "evidence-review",
        label: "Evidence review panel",
        subjectLabel: "Reel Studio",
        sceneIds: [initial.scenes[1].id],
        assets: [{ assetId: video.id, startSeconds: 10 }],
      },
    ];
    await controlProductProof(created.scriptId, {
      action: "save",
      expectedHash: (await readProductProof(created.scriptId)).sourceHash,
      features,
    });
    for (const feature of features) {
      const input = {
        action: "preview" as const,
        expectedHash: (await readProductProof(created.scriptId)).sourceHash,
        featureId: feature.id,
        assetId: feature.assets[0].assetId,
      };
      const preview = await controlProductProof(created.scriptId, input);
      assert.equal(preview.state, "preview");
      await controlProductProof(created.scriptId, {
        ...input,
        action: "apply",
      });
    }
    const final = (await getScript(created.scriptId))!;
    assert.deepEqual(
      final.scenes.map((scene) => ({
        text: scene.text,
        spokenText: scene.spokenText,
      })),
      copy,
    );
    assert.equal(final.productProof!.subjects.length, 1);
    assert.equal(final.scenes[1].background?.startSeconds, 10);
    assert.ok(
      final.scenes.every((scene) => scene.motion?.recipeId === "media-device"),
    );
    const frozen = await captureVideoSnapshot(created.scriptId);
    assert.equal(frozen.script.productProof!.features.length, 2);
    const job = await submitProduction({
      request: {
        kind: "video",
        scriptId: created.scriptId,
        orientation,
        quality: "draft",
        idempotencyKey: `proof-export:${randomUUID()}`,
        runMode: "automatic",
        priority: 100,
        quickProduce: {
          enabled: true,
          planner: "deterministic",
          mediaPreference: "none",
          voice: {
            enabled: false,
            providerId: "kokoro-server",
            voiceId: "af_heart",
          },
        },
      },
      auth: { origin: "web", token: null },
      serverBaseUrl:
        process.env.PROOF_ACCEPTANCE_URL ?? "http://127.0.0.1:3020",
    });
    assert.ok(job);
    assert.equal(
      await prisma.productionJob.count({
        where: { id: { not: job.id }, state: { in: ["queued", "running"] } },
      }),
      0,
      "Another job appeared; do not execute unrelated work",
    );
    await runProductionWorkerOnce({
      workerId: `proof-acceptance:${randomUUID()}`,
      execute: executeProductionJob,
    });
    const saved = await prisma.productionJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { outputs: true },
    });
    assert.equal(saved.state, "succeeded", saved.error ?? "Export failed");
    assert.ok(saved.outputs.length);
    const output =
      saved.outputs.find((output) => output.kind === "video") ??
      saved.outputs[0];
    const { stdout } = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height,nb_frames,r_frame_rate",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        output.path,
      ],
      { timeout: 10000, maxBuffer: 1024 * 1024 },
    );
    const report = {
      orientation,
      ...created,
      jobId: job.id,
      output: { path: output.path, checksum: output.checksum },
      media: JSON.parse(stdout),
      imageAssetId: image.id,
      videoAssetId: video.id,
    };
    results.push(report);
    await mkdir(".artifacts/visual-quality-m5", { recursive: true });
    await writeFile(
      ".artifacts/visual-quality-m5/proof-matrix.json",
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(report));
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
