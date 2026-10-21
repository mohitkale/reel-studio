/** Local M0 runner, also copied unchanged into the published v0.5.0 source tree.
 * Each source version plans, persists and renders its own film through its own
 * repository/compiler/isolated worker. No providers or remote media are used.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, stat, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../src/library/db";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { getScript } from "../src/library/repositories/scripts";
import { createTake } from "../src/library/repositories/takes";
import { createRender, getRender } from "../src/library/repositories/renders";
import { runHyperframesRender } from "../src/library/hyperframes-render";
import { getAssetStore } from "../src/library/storage";
import { makeSilentWav } from "../src/lib/wav";
import { aiSceneSchema } from "../src/providers/ai/types";
import { saveChapterPlan } from "../src/library/chapter-service";
import { dimsFor } from "../src/lib/orientation";
import { productionPresetIdSchema } from "../src/production/presets";
import { productionSceneRoleSchema } from "../src/production/roles";

const run = promisify(execFile);
const recordSchema = z.object({
  scriptId: z.string(),
  takeId: z.string(),
  renderId: z.string().optional(),
  assetFixtureVersion: z.number().optional(),
});
const probeSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string(),
      codec_name: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      r_frame_rate: z.string(),
      nb_frames: z.string().optional(),
    }),
  ),
  format: z.object({ duration: z.string() }),
});
const [corpusPath, outputRoot, version] = process.argv.slice(2);
const corpusSchema = z.object({
  version: z.literal(1),
  seed: z.string(),
  cases: z
    .array(
      z.object({
        id: z.string(),
        presetId: productionPresetIdSchema,
        orientation: z.enum(["portrait", "landscape", "square"]),
        density: z.enum(["sparse", "dense"]),
        language: z.string(),
        suppliedMedia: z.boolean(),
        chapters: z.boolean(),
        roles: z.array(productionSceneRoleSchema),
        scenes: z.array(aiSceneSchema).min(1).max(20),
      }),
    )
    .length(12),
});
async function main() {
  assert(corpusPath && outputRoot && ["v0.5.0", "current"].includes(version));
  const bytes = await readFile(corpusPath),
    corpus = corpusSchema.parse(JSON.parse(bytes.toString()));
  await mkdir(outputRoot, { recursive: true });
  await getAssetStore().put(
    "m0/supplied.png",
    await readFile(
      path.join(path.dirname(corpusPath), "adaptive-baseline-media.png"),
    ),
  );
  const asset = getAssetStore().url("m0/supplied.png");
  for (const item of corpus.cases) {
    const directory = path.join(outputRoot, `${item.id}-${version}`),
      recordPath = path.join(directory, "record.json");
    await mkdir(directory, { recursive: true });
    let record: {
      scriptId: string;
      takeId: string;
      renderId?: string;
      assetFixtureVersion?: number;
    };
    try {
      record = recordSchema.parse(
        JSON.parse(await readFile(recordPath, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const created = await createProjectFromPlan(
        {
          projectName: `M0 · ${item.id} · ${version} · ${item.presetId}`,
          scriptName: `M0 · ${item.id} · ${version} · ${item.language} ${item.density}`,
          styleId: "clean-story",
          energy: "calm",
          scenes: item.scenes,
        },
        item.orientation,
        item.scenes.map((_, index) =>
          item.suppliedMedia && index === 2
            ? { type: "image" as const, url: asset }
            : undefined,
        ),
        "hyperframes",
        undefined,
        {
          brandKitId: null,
          preset: { id: item.presetId, version: "1.0.0" },
          motionPlan: {
            version: "1.0.0",
            seed: corpus.seed,
            ambition: "expressive",
            system: "precision",
            adaptiveRecipes: true,
            sequenceDirection: true,
          },
          roles: item.roles,
          mediaPreferences: item.scenes.map(() => "none"),
        },
      );
      const script = (await getScript(created.scriptId))!;
      let frame = 0;
      const timeline = script.scenes.map((scene) => {
        const durationFrames = Math.ceil(
          Math.max(3, Math.min(20, scene.text.split(/\s+/).length / 3 + 1)) *
            30,
        );
        const beat = {
          sceneId: scene.id,
          startFrame: frame,
          durationFrames,
          text: scene.spokenText ?? scene.text,
        };
        frame += durationFrames;
        return beat;
      });
      const audioPath = `m0/${version}-${item.id}.wav`;
      await getAssetStore().put(audioPath, makeSilentWav(frame / 30));
      const take = await createTake({
        scriptId: script.id,
        providerId: "placeholder",
        voiceId: "silent",
        label: "M0 silent timing fixture",
        fps: 30,
        totalFrames: frame,
        timeline,
        audioPath,
        isPlaceholder: true,
      });
      if (item.chapters)
        await saveChapterPlan(script.id, {
          expected: null,
          expectedSceneIds: script.scenes.map((s) => s.id),
          plan: {
            version: "1.0.0",
            chapters: [0, 2].map((index) => ({
              id: `chapter-${index}`,
              title: index ? "Return and recap" : "Establish the process",
              firstSceneId: script.scenes[index].id,
            })),
          },
        });
      record = { scriptId: script.id, takeId: take.id, assetFixtureVersion: 3 };
      await writeFile(recordPath, JSON.stringify(record, null, 2));
    }
    if (item.suppliedMedia)
      assert.equal(
        record.assetFixtureVersion,
        3,
        "Use a fresh output directory for superseded media fixtures",
      );
    const script = (await getScript(record.scriptId))!;
    if (item.suppliedMedia)
      assert.equal(
        script.scenes[2].background?.url,
        asset,
        "Supplied media must survive persistence before rendering",
      );
    assert.deepEqual(
      script.scenes.map((s) => ({
        text: s.text,
        items: s.items,
        chart: s.chart,
      })),
      item.scenes.map((s) => ({
        text: s.text,
        items: s.items,
        chart: s.chart,
      })),
    );
    await writeFile(
      path.join(directory, "script.json"),
      JSON.stringify(script, null, 2),
    );
    let rendered = record.renderId ? await getRender(record.renderId) : null;
    const started = Date.now();
    if (rendered?.status !== "done") {
      rendered ??= await createRender({
        scriptId: script.id,
        voiceTakeId: record.takeId,
        name: `M0 · ${item.id} · ${version} · ${item.orientation}`,
        quality: "draft",
      });
      record.renderId = rendered.id;
      await writeFile(recordPath, JSON.stringify(record, null, 2));
      await runHyperframesRender({
        renderId: rendered.id,
        scriptId: script.id,
        voiceTakeId: record.takeId,
        quality: "draft",
        orientation: item.orientation,
      });
      rendered = await getRender(rendered.id);
    }
    assert.equal(rendered?.status, "done", rendered?.error ?? "Render failed");
    const mp4 = path.resolve("media/renders", `render-${rendered!.id}.mp4`);
    const metadata = probeSchema.parse(
      JSON.parse(
        (
          await run("ffprobe", [
            "-v",
            "error",
            "-show_entries",
            "stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            mp4,
          ])
        ).stdout,
      ),
    );
    const video = metadata.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === "video",
    );
    assert(video, "Missing video stream");
    assert.equal(video.width, dimsFor(item.orientation).width);
    assert.equal(video.height, dimsFor(item.orientation).height);
    assert.equal(video.r_frame_rate, "30/1");
    let at = 0;
    const frames: string[] = [];
    for (const [index, scene] of script.scenes.entries()) {
      const seconds =
        Math.ceil(
          Math.max(3, Math.min(20, scene.text.split(/\s+/).length / 3 + 1)) *
            30,
        ) / 30;
      const frame = path.join(directory, `scene-${index + 1}.jpg`);
      await run("ffmpeg", [
        "-v",
        "error",
        "-ss",
        String(at + seconds / 2),
        "-i",
        mp4,
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        "-y",
        frame,
      ]);
      frames.push(frame);
      at += seconds;
    }
    // The pinned producer can retain one terminal frame when its seconds-based
    // mux boundary rounds upward. Both source versions use this same runtime.
    const expectedFrames = Math.round(at * 30);
    assert(
      Number(video.nb_frames) >= expectedFrames &&
        Number(video.nb_frames) <= expectedFrames + 1,
    );
    assert(Math.abs(Number(metadata.format.duration) - at) < 0.1);
    const report = {
      caseId: item.id,
      version,
      corpusSha256: createHash("sha256").update(bytes).digest("hex"),
      ...record,
      orientation: item.orientation,
      language: item.language,
      density: item.density,
      suppliedMedia: item.suppliedMedia,
      chapters: item.chapters,
      sourceCopyPreserved: true,
      durationSeconds: at,
      frames: video.nb_frames,
      width: video.width,
      height: video.height,
      bytes: (await stat(mp4)).size,
      sha256: createHash("sha256")
        .update(await readFile(mp4))
        .digest("hex"),
      artifact: path.relative(
        process.env.REEL_M0_ROOT ?? process.cwd(),
        await realpath(mp4),
      ),
      exportedFrames: frames,
      elapsedSeconds: (Date.now() - started) / 1000,
      motions: script.scenes.map((s) => s.motion?.recipeId ?? "preset"),
    };
    await writeFile(
      path.join(directory, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      `M0 verified ${item.id} ${version}: ${at.toFixed(1)}s ${item.orientation}`,
    );
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
