/** Real section export gate using an isolated database and bundled local media.
 * No paid providers. --long exercises 210 seconds; --cancel interrupts a cold
 * second section and verifies that retry keeps the first committed section.
 * --speech uses the already-installed macOS voice, with no provider/network call.
 * Otherwise the narration channel uses a labeled calibration signal.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { planRenderSections } from "../src/production/render-sections";
import { sectionVisualProps } from "../src/production/section-visuals";
import { hashRenderFile } from "../src/library/render-section-cache";

import {
  VIDEO_BENCHMARK_PROFILES,
  videoBenchmarkProfileSchema,
} from "../src/production/video-benchmark";
const benchmarkFlag = process.argv
  .find((value) => value.startsWith("--benchmark="))
  ?.slice(12);
const benchmarkId = benchmarkFlag
  ? videoBenchmarkProfileSchema.parse(benchmarkFlag)
  : null;
const benchmark = benchmarkId ? VIDEO_BENCHMARK_PROFILES[benchmarkId] : null;
const evidenceFlag = process.argv
  .find((value) => value.startsWith("--evidence="))
  ?.slice(11);
const finishing = process.argv.includes("--finishing");
if (finishing && benchmark?.quality !== "high")
  throw new Error(
    "Finishing is an explicit high-quality benchmark experiment.",
  );
const fixtureCancellation = new AbortController();
process.once("SIGINT", () => fixtureCancellation.abort());
process.once("SIGTERM", () => fixtureCancellation.abort());
const execute = promisify(execFile);
const long = process.argv.includes("--long");
const cancel = process.argv.includes("--cancel");
const speech = process.argv.includes("--speech");
const edit = process.argv.includes("--edit");
const seedFlag = process.argv
  .find((value) => value.startsWith("--seed="))
  ?.slice(7);
const fixtureSeed = seedFlag ? z.uuid().parse(seedFlag) : randomUUID();
const engineFlag = process.argv
  .find((value) => value.startsWith("--engine="))
  ?.slice(9);
const engines = engineFlag
  ? [z.enum(["remotion", "hyperframes"]).parse(engineFlag)]
  : (["remotion", "hyperframes"] as const);
const seconds = benchmark?.seconds ?? (long ? 210 : edit ? 62 : 32);
const fps = benchmark?.fps ?? (long ? 24 : 30);
const count = benchmark ? 10 : long ? 6 : edit ? 3 : 2;
const quality = benchmark?.quality ?? "draft";
const frames = seconds * fps;
const narration = Array.from({ length: count }, (_, index) => {
  const words =
    `Chapter ${index + 1} explores how visual rhythm helps an audience follow an explanation. Begin with a clear question. Build the idea one step at a time. Use quieter moments to let the message breathe. Return to the important point with a deliberate reveal. Keep the spoken words and graphics synchronized. Every chapter should feel connected to the story while offering a fresh composition. The ending should make the main idea easy to remember.`.split(
      " ",
    );
  const target = Math.floor((((seconds / count) * 160) / 60) * 0.9);
  return (
    Array.from(
      { length: target },
      (_, word) => words[word % words.length],
    ).join(" ") + "."
  );
});
const sectionEvent = z.object({ index: z.number().int(), reused: z.boolean() });
type SectionEvent = z.infer<typeof sectionEvent>;

async function rms(filename: string, at: number) {
  const { stdout } = await execute(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-ss",
      String(at),
      "-i",
      filename,
      "-t",
      "0.15",
      "-f",
      "f32le",
      "-ar",
      "8000",
      "-ac",
      "1",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 65_536 },
  );
  assert.ok(stdout.length > 0, `No audio at ${at}s`);
  let sum = 0;
  for (let index = 0; index < stdout.length; index += 4)
    sum += stdout.readFloatLE(index) ** 2;
  return 20 * Math.log10(Math.max(1e-12, Math.sqrt(sum / (stdout.length / 4))));
}
async function packetHash(filename: string, stream = "0:v:0") {
  const { stdout } = await execute("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-i",
    filename,
    "-map",
    stream,
    "-c",
    "copy",
    "-f",
    "hash",
    "-hash",
    "sha256",
    "-",
  ]);
  return stdout.trim();
}
async function audioDifference(first: string, retry: string) {
  const decode = async (file: string) =>
    (
      await execute(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-i",
          file,
          "-map",
          "0:a:0",
          "-af",
          "apad",
          "-t",
          String(seconds),
          "-f",
          "f32le",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-",
        ],
        { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
      )
    ).stdout;
  const [a, b] = await Promise.all([decode(first), decode(retry)]);
  // Compare the authored timeline, excluding codec padding after video ends.
  // Native delivery duration and exact video-frame gates are checked separately.
  assert.equal(a.length, b.length);
  let signal = 0,
    difference = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 4) {
    const x = a.readFloatLE(index),
      y = b.readFloatLE(index);
    signal += x * x;
    difference += (x - y) * (x - y);
  }
  const relativeRmsError = Math.sqrt(difference / Math.max(signal, 1e-12));
  assert.ok(
    relativeRmsError < 0.02,
    `Retry changed decoded audio (relative RMS error ${relativeRmsError})`,
  );
  return {
    relativeRmsError,
    comparedSamples: Math.min(a.length, b.length) / 4,
    firstEncodedHash: await packetHash(first, "0:a:0"),
    retryEncodedHash: await packetHash(retry, "0:a:0"),
  };
}
/** Conservative sum: shared pages may be counted in more than one process. */
function sampleRenderMemory() {
  let peakRssBytes = 0;
  let samples = 0;
  let samplingError: string | null = null;
  let pending: Promise<void> | undefined;
  const sample = async () => {
    const { stdout } = await execute("ps", ["-axo", "pid=,ppid=,rss="], {
      timeout: 2000,
    });
    const rows = stdout
      .trim()
      .split("\n")
      .map((row) => row.trim().split(/\s+/).map(Number));
    const descendants = new Set([process.pid]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [pid, parent] of rows)
        if (descendants.has(parent) && !descendants.has(pid)) {
          descendants.add(pid);
          changed = true;
        }
    }
    peakRssBytes = Math.max(
      peakRssBytes,
      rows.reduce(
        (sum, [pid, , rss]) => sum + (descendants.has(pid) ? rss * 1024 : 0),
        0,
      ),
    );
    samples++;
  };
  const timer = setInterval(() => {
    if (!pending && process.platform !== "win32")
      pending = sample()
        .catch((error) => {
          samplingError =
            error instanceof Error ? error.message : String(error);
        })
        .finally(() => {
          pending = undefined;
        });
  }, 1000);
  return async () => {
    clearInterval(timer);
    await pending;
    return {
      sampledPeakProcessTreeRssBytes: samples ? peakRssBytes : null,
      memorySamples: samples,
      samplingError,
    };
  };
}
async function main() {
  const directory = evidenceFlag
    ? path.resolve(evidenceFlag)
    : path.resolve(".artifacts", `video-sections-${Date.now()}`);
  if (evidenceFlag) {
    const artifacts = path.resolve(".artifacts");
    if (!directory.startsWith(artifacts + path.sep))
      throw new Error("Benchmark evidence must stay under .artifacts.");
  }
  const mediaKey = `regression/video-sections-${fixtureSeed}`;
  const media = path.resolve("media", mediaKey);
  await fs.mkdir(directory, { recursive: !evidenceFlag });
  await fs.mkdir(path.dirname(media), { recursive: true });
  // A stable seed supports repeatable diagnostics without overwriting a
  // concurrent fixture. Only this run's exclusively created media is cleaned.
  await fs.mkdir(media);
  const database = path.join(directory, "test.db");
  const db = new DatabaseSync(database);
  for (const migration of (await fs.readdir("prisma/migrations")).sort()) {
    if (migration.endsWith(".toml")) continue;
    db.exec(
      await fs.readFile(
        path.join("prisma/migrations", migration, "migration.sql"),
        "utf8",
      ),
    );
  }
  db.close();
  process.env.DATABASE_URL = `file:${database}`;
  const { prisma } = await import("../src/library/db");
  const { captureVideoSnapshot } =
    await import("../src/library/video-snapshot");
  const { createRender } = await import("../src/library/repositories/renders");
  const { runRenderNow, prepareVideoComposition } =
    await import("../src/library/render-service");
  const { withProductionSignal } =
    await import("../src/library/production-cancellation");
  const { verifyProductionMp4 } =
    await import("../src/library/video-production-orchestrator");

  if (speech) {
    if (process.platform !== "darwin")
      throw new Error(
        "--speech requires the installed macOS system voice. Use the default calibration gate on other platforms.",
      );
    const clips: string[] = [];
    for (const [index, text] of narration.entries()) {
      const source = path.join(directory, `chapter-${index}.txt`);
      const aiff = path.join(directory, `chapter-${index}.aiff`);
      const wav = path.join(directory, `chapter-${index}.wav`);
      await fs.writeFile(source, text);
      await execute("/usr/bin/say", ["-r", "160", "-f", source, "-o", aiff], {
        timeout: 60_000,
      });
      const { stdout } = await execute("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        aiff,
      ]);
      assert.ok(
        Number(JSON.parse(stdout).format.duration) < seconds / count,
        "Installed voice exceeded the chapter slot; do not silently truncate narration",
      );
      await execute("ffmpeg", [
        "-v",
        "error",
        "-nostdin",
        "-i",
        aiff,
        "-af",
        "apad",
        "-t",
        String(seconds / count),
        "-ar",
        "48000",
        "-c:a",
        "pcm_s16le",
        wav,
      ]);
      clips.push(wav);
    }
    const list = path.join(directory, "voice-concat.txt");
    await fs.writeFile(
      list,
      clips
        .map((filename) => `file '${filename.replaceAll("'", "'\\''")}'`)
        .join("\n"),
    );
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c:a",
      "pcm_s16le",
      path.join(media, "voice.wav"),
    ]);
  } else
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      `aevalsrc=0.12*sin(2*PI*220*t)*lt(mod(t\\,10)\\,2):s=48000:d=${seconds}`,
      "-c:a",
      "pcm_s16le",
      path.join(media, "voice.wav"),
    ]);
  if (benchmark)
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=24:duration=8",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      path.join(media, "footage.mp4"),
    ]);
  await fs.copyFile("public/sfx/pop.wav", path.join(media, "pop.wav"));
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      const filename =
        pathname === "/music/tech-minimal.wav"
          ? path.resolve("public/music/tech-minimal.wav")
          : pathname === `/media/${mediaKey}/voice.wav`
            ? path.join(media, "voice.wav")
            : pathname === `/media/${mediaKey}/pop.wav`
              ? path.join(media, "pop.wav")
              : benchmark && pathname === `/media/${mediaKey}/footage.mp4`
                ? path.join(media, "footage.mp4")
                : null;
      if (!filename) {
        res.writeHead(404);
        res.end();
        return;
      }
      const bytes = await fs.readFile(filename);
      res.writeHead(200, {
        "Content-Type": filename.endsWith(".mp4") ? "video/mp4" : "audio/wav",
        "Content-Length": bytes.length,
      });
      res.end(bytes);
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const sceneIds = Array.from(
    { length: count },
    (_, index) => `section-scene-${path.basename(mediaKey)}-${index}`,
  );
  const evidence: unknown[] = [];
  let events: SectionEvent[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => {
    const line = values.map(String).join(" ");
    const match = line.match(/(?:HF_SECTION|\[render:sections\]) (\{.*\})/);
    if (match) events.push(sectionEvent.parse(JSON.parse(match[1])));
    originalLog(...values);
  };
  try {
    await prisma.project.create({
      data: {
        id: "section-proof",
        name: "Section export regression",
        scripts: {
          create: {
            id: "section-proof-script",
            name: "Section continuity",
            fps,
            width: benchmark?.width ?? (long ? 1280 : 1080),
            height: benchmark?.height ?? (long ? 720 : 1920),
            musicUrl: "/music/tech-minimal.wav",
            musicVolume: 30,
            brandOverrides: JSON.stringify({
              chapterPlan: {
                version: "1.0.0",
                chapters: sceneIds.map((firstSceneId, index) => ({
                  id: `chapter-${index}`,
                  title: `Chapter ${index + 1}`,
                  firstSceneId,
                })),
              },
              audioMastering: "balanced",
              productionPreset: { id: "editorial-explainer", version: "1.0.0" },
            }),
            scenes: {
              create: sceneIds.map((id, index) => ({
                id,
                order: index,
                text: `Chapter ${index + 1}: give every moment a purpose`,
                spokenText: speech ? narration[index] : null,
                templateId: "hf-statement",
                layoutJson: JSON.stringify({
                  role: index === 0 ? "hook" : "takeaway",
                  ...(benchmark && index % 2 === 0
                    ? {
                        background: {
                          type: "video",
                          url: `/media/${mediaKey}/footage.mp4`,
                          muted: true,
                        },
                      }
                    : {}),
                  motion: {
                    recipeId:
                      benchmark && index % 2 === 0
                        ? index % 4 === 0
                          ? "media-device"
                          : "media-cinematic"
                        : index % 2
                          ? "type-editorial"
                          : "type-impact",
                    version: "1.0.0",
                  },
                }),
              })),
            },
          },
        },
      },
    });
    await prisma.voiceTake.create({
      data: {
        id: "section-proof-take",
        scriptId: "section-proof-script",
        label: speech
          ? "Installed local voice"
          : "Calibration signal (not speech)",
        providerId: "regression",
        voiceId: "calibration",
        fps,
        totalFrames: frames,
        timingJson: JSON.stringify(
          sceneIds.map((sceneId, index) => ({
            sceneId,
            startFrame: (index * frames) / count,
            durationFrames: frames / count,
            text: speech
              ? narration[index]
              : `Chapter ${index + 1}: give every moment a purpose`,
          })),
        ),
        audioPath: `${mediaKey}/voice.wav`,
      },
    });
    for (const engine of engines) {
      await prisma.project.update({
        where: { id: "section-proof" },
        data: { videoEngine: engine },
      });
      const snapshot = await captureVideoSnapshot(
        "section-proof-script",
        "section-proof-take",
      );
      const timeline = sceneIds.map((sceneId, index) => ({
        sceneId,
        startFrame: (index * frames) / count,
        durationFrames: frames / count,
      }));
      const prepared = prepareVideoComposition(
        snapshot,
        { timeline, totalFrames: frames, takeUsable: true },
        undefined,
        base,
      );
      prepared.props.sfxCues = timeline.slice(1).map((beat) => ({
        url: `${base}/media/${mediaKey}/pop.wav`,
        startFrame: beat.startFrame,
        volume: 0.2,
      }));
      prepared.props.captions = {
        enabled: true,
        timingSource: "imported",
        cues: timeline.map((beat, index) => ({
          id: `caption-${index}`,
          startFrame: beat.startFrame,
          endFrame: beat.startFrame + beat.durationFrames,
          text: `Section ${index + 1}: continuous global timing`,
        })),
      };
      const expectedSections = planRenderSections(
        frames,
        fps,
        engine === "remotion" ? timeline.map((beat) => beat.startFrame) : [],
      );
      const files: string[] = [];
      const run = async (interrupt = false) => {
        const render = await createRender({
          scriptId: "section-proof-script",
          quality,
        });
        const output = path.resolve("media/renders", `render-${render.id}.mp4`);
        files.push(output, `${output}.audio.json`);
        events = [];
        const controller = new AbortController();
        const started = performance.now();
        const finishMemory = sampleRenderMemory();
        let memory: Awaited<ReturnType<typeof finishMemory>>;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // Poll events instead of progress thresholds: progress can advance while
        // the first section is still uncommitted.
        if (interrupt)
          timer = setInterval(() => {
            if (events.some((event) => event.index === 0)) {
              clearInterval(timer);
              timer = setTimeout(
                () =>
                  controller.abort(
                    new Error("Section regression cancellation"),
                  ),
                1500,
              );
            }
          }, 100);
        try {
          await withProductionSignal(
            AbortSignal.any([controller.signal, fixtureCancellation.signal]),
            () =>
              runRenderNow({
                renderId: render.id,
                scriptId: "section-proof-script",
                snapshot,
                prepared,
                serverBaseUrl: base,
                quality,
              }),
          );
        } catch (error) {
          if (!interrupt || !controller.signal.aborted) throw error;
        } finally {
          clearTimeout(timer);
          memory = await finishMemory();
        }
        if (interrupt) {
          assert.ok(
            controller.signal.aborted,
            "Cancellation must interrupt actual rendering",
          );
          assert.ok(
            events.some((event) => event.index === 0 && !event.reused),
            "Cancellation must follow a cold completed section",
          );
          assert.equal(
            await fs.access(output).then(
              () => true,
              () => false,
            ),
            false,
          );
          for (const suffix of ["", "-sections"])
            assert.equal(
              await fs
                .access(path.resolve("media/hf-work", render.id + suffix))
                .then(
                  () => true,
                  () => false,
                ),
              false,
            );
          return {
            output,
            events: [...events],
            milliseconds: performance.now() - started,
            ...memory,
          };
        }
        const metadata = await verifyProductionMp4(output, true);
        assert.equal(metadata.audioMastering?.status, "verified");
        assert.ok(
          Math.abs(metadata.duration - seconds) < 1 / fps,
          `${engine} delivery duration ${metadata.duration}s differs from ${seconds}s`,
        );
        const { stdout } = await execute("ffprobe", [
          "-v",
          "error",
          "-count_packets",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=nb_read_packets",
          "-of",
          "json",
          output,
        ]);
        assert.equal(
          Number(JSON.parse(stdout).streams[0].nb_read_packets),
          frames,
        );
        if (benchmark) {
          const scale =
            engine === "remotion"
              ? quality === "draft"
                ? 0.5
                : quality === "high"
                  ? 4 / 3
                  : 1
              : 1;
          assert.equal(metadata.width, Math.round(benchmark.width * scale));
          assert.equal(metadata.height, Math.round(benchmark.height * scale));
        }
        assert.equal(events.length, expectedSections.length);
        const probes = [];
        for (const at of [
          ...new Set([
            16.5,
            seconds - 3,
            ...expectedSections
              .slice(1)
              .map((section) => section.startFrame / fps - 0.1),
          ]),
        ]) {
          const dbfs = await rms(output, at);
          assert.ok(dbfs > -65, `${engine} audio became silent at ${at}s`);
          probes.push({ seconds: at, dbfs });
        }
        return {
          output,
          events: [...events],
          milliseconds: performance.now() - started,
          ...memory,
          metadata,
          probes,
        };
      };
      try {
        const canceled = cancel ? await run(true) : null;
        const first = await run();
        if (cancel)
          assert.ok(
            first.events.some((event) => event.index === 0 && event.reused),
            "Retry must reuse completed work",
          );
        const retry = await run();
        assert.ok(
          retry.events.every((event) => event.reused),
          "Unchanged retry must reuse all sections",
        );
        assert.equal(
          await packetHash(first.output),
          await packetHash(retry.output),
        );
        const audioConsistency = await audioDifference(
          first.output,
          retry.output,
        );
        let edited;
        const scopedParity: Array<{ frame: number; sha256: string }> = [];
        if (edit) {
          const originalProps = prepared.props;
          const { renderVisualReviewFrames } =
            await import("../src/library/visual-review");
          const parityDir = path.join(directory, "section-parity");
          for (const section of [
            expectedSections[0],
            expectedSections.at(-1)!,
          ]) {
            const frame = Math.floor(
              (section.startFrame + section.endFrame) / 2,
            );
            const full = await renderVisualReviewFrames(
              engine,
              { ...originalProps, fps },
              frames,
              [frame],
              path.join(parityDir, `full-${section.index}`),
              base,
            );
            const scoped = await renderVisualReviewFrames(
              engine,
              { ...sectionVisualProps(originalProps, section, fps), fps },
              frames,
              [frame],
              path.join(parityDir, `scoped-${section.index}`),
              base,
            );
            const sha256 = await hashRenderFile(full[0]);
            assert.equal(
              sha256,
              await hashRenderFile(scoped[0]),
              "Scoped visual frames must match the complete composition",
            );
            scopedParity.push({ frame, sha256 });
          }
          prepared.props = structuredClone(originalProps);
          prepared.props.scenes.at(-1)!.text = "A revised final chapter visual";
          edited = await run();
          const changedSceneId = originalProps.scenes.at(-1)!.id;
          const affected = new Set(
            expectedSections
              .filter((section) =>
                sectionVisualProps(originalProps, section, fps).scenes.some(
                  (scene) => scene.id === changedSceneId,
                ),
              )
              .map((section) => section.index),
          );
          assert.ok(
            affected.size < expectedSections.length,
            "Fixture must include an unchanged visual section",
          );
          for (const event of edited.events)
            assert.equal(
              event.reused,
              !affected.has(event.index),
              `Section ${event.index} must invalidate exactly when its visual changes`,
            );
          const lastStart = timeline.at(-1)!.startFrame;
          const imageHash = async (file: string, at: number) =>
            (
              await execute("ffmpeg", [
                "-v",
                "error",
                "-nostdin",
                "-ss",
                String(at),
                "-i",
                file,
                "-frames:v",
                "1",
                "-f",
                "hash",
                "-hash",
                "sha256",
                "-",
              ])
            ).stdout.trim();
          assert.equal(
            await imageHash(first.output, 3),
            await imageHash(edited.output, 3),
          );
          assert.notEqual(
            await imageHash(
              first.output,
              (lastStart + (frames / count) * 0.65) / fps,
            ),
            await imageHash(
              edited.output,
              (lastStart + (frames / count) * 0.65) / fps,
            ),
          );
          prepared.props = originalProps;
        }
        const { createVisualReview } =
          await import("../src/library/visual-review");
        const reviewDir = path.join(directory, `${engine}-review`);
        await fs.mkdir(reviewDir, { recursive: true });
        let reviewedScenes = 0;
        const sceneFrames: number[] = [];
        // Preserve the production review limit for longer benchmark fixtures.
        for (let offset = 0; offset < sceneIds.length; offset += 8) {
          const review = await createVisualReview(
            "section-proof-script",
            {
              sceneIds: sceneIds.slice(offset, offset + 8),
              samples: 1,
              voiceTakeId: "section-proof-take",
            },
            base,
          );
          assert.ok(review.takeUsable);
          reviewedScenes += review.stills.length;
          sceneFrames.push(...review.stills.map((still) => still.frame));
          for (const still of review.stills)
            await fs.copyFile(
              path.resolve("media", still.url.slice(7)),
              path.join(reviewDir, `scene-${still.sceneNumber}.png`),
            );
        }
        assert.equal(reviewedScenes, count);
        const cut = await createVisualReview(
          "section-proof-script",
          {
            sceneIds: [sceneIds[1]],
            samples: 1,
            mode: "transition",
            voiceTakeId: "section-proof-take",
          },
          base,
        );
        assert.equal(cut.stills.length, 8);
        for (const still of cut.stills)
          await fs.copyFile(
            path.resolve("media", still.url.slice(7)),
            path.join(reviewDir, `cut-${still.frame}.png`),
          );
        await fs.copyFile(first.output, path.join(directory, `${engine}.mp4`));
        await fs.copyFile(
          `${first.output}.audio.json`,
          path.join(directory, `${engine}.audio.json`),
        );
        let finishingReport;
        if (benchmark) {
          const delivery = path.join(directory, `${engine}-${benchmarkId}.mp4`);
          await fs.copyFile(first.output, delivery);
          const encodedReview = path.join(directory, "encoded-review");
          await fs.mkdir(encodedReview);
          for (const [index, beat] of timeline.entries())
            await execute("ffmpeg", [
              "-v",
              "error",
              "-nostdin",
              "-ss",
              String(beat.startFrame / fps + 3),
              "-i",
              delivery,
              "-frames:v",
              "1",
              "-vf",
              "scale=320:-1",
              path.join(
                encodedReview,
                `scene-${String(index).padStart(2, "0")}.png`,
              ),
            ]);
          await execute("ffmpeg", [
            "-v",
            "error",
            "-nostdin",
            "-framerate",
            "1",
            "-i",
            path.join(encodedReview, "scene-%02d.png"),
            "-vf",
            "tile=5x2:padding=8:margin=8:color=0x151515",
            "-frames:v",
            "1",
            path.join(encodedReview, "sheet.jpg"),
          ]);
          if (finishing) {
            const { finishVideoExperiment } =
              await import("../src/library/video-finishing-experiment");
            const finishMemory = sampleRenderMemory();
            try {
              finishingReport = await finishVideoExperiment(
                delivery,
                path.join(directory, `${engine}-${benchmarkId}-finished.mp4`),
                {
                  mode: "temporal-blend-3",
                  quality: "high",
                  fps,
                  totalFrames: frames,
                  cutFrames: timeline.slice(1).map((beat) => beat.startFrame),
                },
                fixtureCancellation.signal,
              );
            } finally {
              const memory = await finishMemory();
              if (finishingReport)
                finishingReport = { ...finishingReport, ...memory };
            }
          }
        }
        evidence.push({
          engine,
          benchmarkId,
          quality,
          nativeCanvas: benchmark ? [benchmark.width, benchmark.height] : null,
          secondsPerVideoMinute: first.milliseconds / 1000 / (seconds / 60),
          secondsPerVideoMinuteOnRetry:
            retry.milliseconds / 1000 / (seconds / 60),
          finishingReport,
          audioConsistency,
          edited,
          scopedParity,
          review: {
            sceneFrames,
            cutFrames: cut.stills.map((still) => still.frame),
          },
          seconds,
          fps,
          frames,
          calibrationNarration: !speech,
          canceled,
          first,
          retry,
        });
        await fs.writeFile(
          path.join(directory, "result.json"),
          JSON.stringify(evidence, null, 2),
        );
      } catch (error) {
        // Keep failed deliveries inspectable before cleaning the isolated run.
        for (const filename of files)
          await fs
            .copyFile(
              filename,
              path.join(directory, `failed-${path.basename(filename)}`),
            )
            .catch(() => undefined);
        await fs.writeFile(
          path.join(directory, `${engine}-failure.txt`),
          String(error),
        );
        throw error;
      } finally {
        for (const filename of files) await fs.rm(filename, { force: true });
      }
    }
    await fs.writeFile(
      path.join(directory, "result.json"),
      JSON.stringify(evidence, null, 2),
    );
    originalLog(`Section export gate passed. Evidence: ${directory}`);
  } finally {
    console.log = originalLog;
    server.close();
    await once(server, "close");
    await prisma.$disconnect();
    await fs.rm(media, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
