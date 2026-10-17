/** Opt-in M5 gate. Saves 3/5/10-minute synthetic lessons and verified MP4s
 * in the active app. Local graphics + silent timing fixtures; no providers.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { getScript } from "../src/library/repositories/scripts";
import { createTake } from "../src/library/repositories/takes";
import { createRender, getRender } from "../src/library/repositories/renders";
import { saveChapterPlan } from "../src/library/chapter-service";
import { captureVideoSnapshot } from "../src/library/video-snapshot";
import {
  createProductionRevision,
  videoRevisionHash,
} from "../src/library/production-revision";
import {
  prepareVideoComposition,
  runRenderNow,
} from "../src/library/render-service";
import { withProductionSignal } from "../src/library/production-cancellation";
import { getAssetStore } from "../src/library/storage";
import { makeSilentWav } from "../src/lib/wav";
import { prisma } from "../src/library/db";
import {
  lessonDirections,
  assertLessonHtmlBudget,
  LONG_FORM_BUDGETS,
} from "../src/production/long-form";
import {
  assertVideoDuration,
  videoDurationLimit,
} from "../src/production/limits";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition";
import { resolveReelTimeline } from "../src/lib/reel-timeline";
import { planRenderSections } from "../src/production/render-sections";
import type { ScenePlan } from "../src/providers/ai/types";

const execute = promisify(execFile),
  root = ".artifacts/adaptive-m5";
const sectionSchema = z.object({
  index: z.number().int(),
  reused: z.boolean(),
});
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
function sampleMemory() {
  let peak = 0,
    samples = 0,
    pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (pending || process.platform === "win32") return;
    pending = execute("ps", ["-axo", "pid=,ppid=,rss="], { timeout: 2000 })
      .then(({ stdout }) => {
        const rows = stdout
            .trim()
            .split("\n")
            .map((row) => row.trim().split(/\s+/).map(Number)),
          ids = new Set([process.pid]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const [pid, parent] of rows)
            if (ids.has(parent) && !ids.has(pid)) {
              ids.add(pid);
              changed = true;
            }
        }
        peak = Math.max(
          peak,
          rows.reduce(
            (sum, [pid, , rss]) => sum + (ids.has(pid) ? rss * 1024 : 0),
            0,
          ),
        );
        samples++;
      })
      .catch(() => {})
      .finally(() => {
        pending = undefined;
      });
  }, 1000);
  return async () => {
    clearInterval(timer);
    await pending;
    return {
      sampledPeakProcessTreeRssBytes: samples ? peak : null,
      memorySamples: samples,
    };
  };
}
async function videoInfo(filename: string) {
  const { stdout } = await execute("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,nb_frames,r_frame_rate,duration",
    "-of",
    "json",
    filename,
  ]);
  return z
    .object({
      streams: z.array(
        z.object({
          width: z.number(),
          height: z.number(),
          nb_frames: z.coerce.number(),
          r_frame_rate: z.string(),
          duration: z.coerce.number(),
        }),
      ),
    })
    .parse(JSON.parse(stdout)).streams[0];
}
async function packetHash(filename: string) {
  return (
    await execute("ffmpeg", [
      "-v",
      "error",
      "-i",
      filename,
      "-map",
      "0:v:0",
      "-c",
      "copy",
      "-f",
      "hash",
      "-hash",
      "sha256",
      "-",
    ])
  ).stdout.trim();
}
const savedRecordSchema = z.object({
  projectId: z.string(),
  scriptId: z.string(),
  takeId: z.string(),
  revisionId: z.string(),
  seconds: z.number(),
  scenes: z.number(),
  chapters: z.number(),
  htmlBytes: z.number(),
  sectionCount: z.number(),
  runs: z.array(z.unknown()),
});
async function main() {
  await mkdir(root, { recursive: true });
  const records: z.infer<typeof savedRecordSchema>[] = process.argv.includes(
    "--resume",
  )
    ? z
        .array(savedRecordSchema)
        .parse(JSON.parse(await readFile(`${root}/examples.json`, "utf8")))
    : [];
  for (const seconds of [180, 300, 600]) {
    controller.signal.throwIfAborted();
    let record = records.find((row) => row.seconds === seconds);
    const labels = (record?.runs ?? []).map(
      (run) => z.object({ label: z.string() }).parse(run).label,
    );
    if (
      labels.includes("accepted offline export") &&
      (seconds !== 600 || labels.includes("cached retry"))
    )
      continue;
    const chapterCount = seconds / 60;
    if (!record) {
      const scenes: ScenePlan["scenes"] = Array.from(
        { length: chapterCount },
        (_, chapter): ScenePlan["scenes"] => [
          {
            templateId: "hf-list",
            text: `Chapter ${chapter + 1}: Capture, then Review, then Publish.`,
            spokenText:
              "Capture supplied content. Review its source and wording. Publish the reviewed version. These named stages stay consistent as we return to the process.",
            items: ["Capture", "Review", "Publish"],
            emphasis: [],
          },
          {
            templateId: "hf-statement",
            text: "Review keeps supplied content authoritative.",
            spokenText:
              "Review checks the content you supplied. A visual variation keeps narration and facts intact. The same saved subject can return in another chapter.",
            emphasis: [],
          },
          {
            templateId: "hf-list",
            text: "Compare a draft and a reviewed version.",
            spokenText:
              "A draft contains supplied content before review. A reviewed version contains that content after review. This is a synthetic workflow example, without invented performance results.",
            items: ["Draft", "Reviewed version"],
            emphasis: [],
          },
          {
            templateId: "hf-list",
            text:
              chapter === chapterCount - 1
                ? "Recap: Capture, then Review, then Publish."
                : "Return to Capture, Review and Publish.",
            spokenText:
              "Return to the same Capture, Review and Publish stages. The diagram carries their saved identities and colours. This recap introduces no new evidence.",
            items: ["Capture", "Review", "Publish"],
            emphasis: [],
          },
        ],
      ).flat();
      const created = await createProjectFromPlan(
        {
          projectName: `M5 · ${seconds / 60}-minute lesson`,
          scriptName: `M5 · ${seconds / 60}-minute lesson`,
          styleId: "clean-story",
          energy: "calm",
          scenes,
        },
        "landscape",
        [],
        "hyperframes",
        { styleId: "clean-story", energy: "calm" },
        {
          preset: { id: "editorial-explainer", version: "1.0.0" },
          roles: scenes.map((_, index) =>
            index % 4 === 0 || index % 4 === 3
              ? "diagram"
              : index % 4 === 2
                ? "comparison"
                : "explanation",
          ),
          mediaPreferences: scenes.map(() => "none"),
        },
      );
      await prisma.script.update({
        where: { id: created.scriptId },
        data: { width: 1280, height: 720, fps: 24 },
      });
      let script = (await getScript(created.scriptId))!;
      const chapters = Array.from({ length: chapterCount }, (_, index) => ({
        id: `lesson:${index + 1}`,
        title:
          index === chapterCount - 1
            ? "Recap"
            : index % 2
              ? `Example ${index + 1}`
              : `Develop ${index + 1}`,
        firstSceneId: script.scenes[index * 4].id,
      }));
      const directions = lessonDirections(chapters);
      await saveChapterPlan(script.id, {
        expected: null,
        expectedSceneIds: script.scenes.map((scene) => scene.id),
        plan: {
          version: "1.0.0",
          longForm: { version: "1.0.0", targetSeconds: seconds },
          chapters: chapters.map((chapter, index) => ({
            ...chapter,
            direction: directions[index],
          })),
        },
      });
      script = (await getScript(script.id))!;
      const audioPath = `fixtures/m5-${seconds}-silent.wav`;
      await getAssetStore().put(audioPath, makeSilentWav(seconds));
      const take = await createTake({
        scriptId: script.id,
        label: "M5 · Silent 15-second timing fixture",
        providerId: "placeholder",
        voiceId: "silent",
        fps: 24,
        totalFrames: seconds * 24,
        timeline: script.scenes.map((scene, index) => ({
          sceneId: scene.id,
          text: scene.spokenText ?? scene.text,
          startFrame: index * 360,
          durationFrames: 360,
        })),
        audioPath,
        isPlaceholder: true,
      });
      const snapshot = await captureVideoSnapshot(script.id, take.id);
      const revision = await createProductionRevision(snapshot);
      record = {
        ...created,
        takeId: take.id,
        revisionId: revision.id,
        seconds,
        scenes: scenes.length,
        chapters: chapterCount,
        htmlBytes: 0,
        sectionCount: planRenderSections(seconds * 24, 24).length,
        runs: [],
      };
      records.push(record);
      await writeFile(
        `${root}/examples.json`,
        JSON.stringify(records, null, 2),
      );
    }
    const script = (await getScript(record.scriptId))!;
    const take = { id: record.takeId };
    const snapshot = await captureVideoSnapshot(script.id, take.id);
    const frozen = await prisma.productionRevision.findUniqueOrThrow({
      where: { id: record.revisionId },
    });
    assert.equal(
      videoRevisionHash(snapshot),
      frozen.revisionHash,
      "Saved example changed; do not resume against a different revision.",
    );
    const resolved = resolveReelTimeline(
      script.scenes.map((scene) => ({
        id: scene.id,
        text: scene.spokenText ?? scene.text,
      })),
      snapshot.take,
      24,
    );
    const prepared = prepareVideoComposition(
      snapshot,
      resolved,
      undefined,
      process.env.REEL_VERIFY_BASE_URL ?? "http://127.0.0.1:3010",
    );
    assertVideoDuration(prepared.totalFrames, 24, videoDurationLimit(script));
    const html = buildHyperframesCompositionHtml(prepared.props, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
    });
    const htmlBytes = Buffer.byteLength(html);
    assertLessonHtmlBudget(htmlBytes);
    await writeFile(
      `${root}/${seconds}-preview.html`,
      buildHyperframesCompositionHtml(prepared.props),
    );
    record.htmlBytes = htmlBytes;
    const activeRecord = record;
    const run = async (label: string, interrupt = false) => {
      const render = await createRender({
        scriptId: script.id,
        voiceTakeId: take.id,
        name: `M5 · ${seconds / 60} min · ${label}`,
        quality: "draft",
      });
      const events: z.infer<typeof sectionSchema>[] = [],
        originalLog = console.log;
      console.log = (...args: unknown[]) => {
        const line = args.map(String).join(" "),
          match = line.match(/HF_SECTION (\{.*\})/);
        if (match) events.push(sectionSchema.parse(JSON.parse(match[1])));
        originalLog(...args);
      };
      const abort = new AbortController(),
        stopMemory = sampleMemory(),
        started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (interrupt)
        timer = setInterval(() => {
          if (events.some((event) => event.index === 0)) {
            clearInterval(timer);
            timer = setTimeout(
              () => abort.abort(new Error("M5 cold section cancellation")),
              1000,
            );
          }
        }, 100);
      const memory: {
        sampledPeakProcessTreeRssBytes: number | null;
        memorySamples: number;
      } = { sampledPeakProcessTreeRssBytes: null, memorySamples: 0 };
      try {
        await withProductionSignal(
          AbortSignal.any([controller.signal, abort.signal]),
          () =>
            runRenderNow({
              scriptId: script.id,
              renderId: render.id,
              snapshot,
              prepared,
              quality: "draft",
              serverBaseUrl:
                process.env.REEL_VERIFY_BASE_URL ?? "http://127.0.0.1:3010",
            }),
        );
      } catch (error) {
        if (!interrupt || !abort.signal.aborted) throw error;
      } finally {
        clearTimeout(timer);
        console.log = originalLog;
        Object.assign(memory, await stopMemory());
      }
      const result = await getRender(render.id),
        milliseconds = performance.now() - started;
      if (interrupt) {
        assert.ok(abort.signal.aborted);
        assert.ok(events.some((event) => event.index === 0 && !event.reused));
      } else {
        assert.equal(result?.status, "done", result?.error ?? "Missing output");
      }
      const filename = result?.outputUrl
        ? path.resolve("media", result.outputUrl.split("/media/")[1])
        : undefined;
      const metadata = filename ? await videoInfo(filename) : undefined;
      if (metadata) {
        assert.equal(metadata.nb_frames, seconds * 24);
        assert.equal(metadata.r_frame_rate, "24/1");
        assert.equal(metadata.width, 1280);
        assert.equal(metadata.height, 720);
        assert.equal(metadata.duration, seconds);
      }
      const row = {
        renderId: render.id,
        label,
        milliseconds,
        secondsPerVideoMinute: milliseconds / 1000 / (seconds / 60),
        events,
        ...memory,
        metadata,
        outputUrl: result?.outputUrl,
        outputBytes: filename ? (await stat(filename)).size : undefined,
        videoPackets: filename ? await packetHash(filename) : undefined,
      };
      activeRecord.runs.push(row);
      await writeFile(
        `${root}/examples.json`,
        JSON.stringify(records, null, 2),
      );
      return row;
    };
    console.log(
      `M5 ${seconds}s: ${script.scenes.length} scenes, ${chapterCount} chapters, ${record.sectionCount} sections, ${htmlBytes} compiled bytes. Budgets: ${JSON.stringify(LONG_FORM_BUDGETS)}`,
    );
    if (seconds === 180 && !labels.includes("cold cancellation fixture"))
      await run("cold cancellation fixture", true);
    await prisma.$disconnect(); // fresh adapter connection, persisted source and takes
    const first = await run("accepted offline export");
    if (seconds === 180)
      assert.ok(
        first.events.some((event) => event.index === 0 && event.reused),
      );
    if (seconds === 600) {
      const retry = await run("cached retry");
      assert.ok(
        retry.events.length === record.sectionCount &&
          retry.events.every((event) => event.reused),
      );
      assert.equal(first.videoPackets, retry.videoPackets);
    }
  }
  await prisma.$disconnect();
  console.log(`M5 3/5/10-minute acceptance passed: ${root}/examples.json`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
