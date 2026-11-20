import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { z } from "zod";

const ffmpeg = process.env.FFMPEG_BIN?.trim() || "ffmpeg";
const ffprobe = process.env.FFPROBE_BIN?.trim() || "ffprobe";
const ffmpegOptions = [
  "-hide_banner",
  "-nostdin",
  "-nostats",
  "-threads",
  "1",
  "-filter_threads",
  "1",
];
const cutThreshold = 0.05;
const minimumCutGap = 0.35;
const sampleFractions = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];
const minimumOcrConfidence = 70;

const annotationsSchema = z.record(
  z.string(),
  z
    .strictObject({
      sceneBoundariesSeconds: z.array(z.number().positive()).optional(),
      storyboard: z.string().min(1).optional(),
      transcript: z.string().min(1).optional(),
    })
    .refine(({ storyboard, transcript }) => !(storyboard && transcript), {
      message: "Supply either a storyboard JSON or a plain-text transcript.",
    }),
);
const narrationSchema = z.object({
  scenes: z.array(z.object({ narration: z.string().optional() })),
});
const probeSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      duration: z.string().optional(),
      disposition: z.object({ attached_pic: z.number().optional() }).optional(),
    }),
  ),
  format: z.object({ duration: z.string().optional() }),
});

function run(program, args, input) {
  const result = spawnSync(program, args, {
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${program} exited with status ${result.status}: ${result.stderr.toString().slice(-800)}`,
    );
  }
  return result;
}

function round(value) {
  return Number(value.toFixed(2));
}

function spread(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction) => {
    const index = fraction * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return round(
      sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower),
    );
  };
  return {
    min: percentile(0),
    p10: percentile(0.1),
    median: percentile(0.5),
    p90: percentile(0.9),
    max: percentile(1),
  };
}

function readLoudness(video) {
  const filter = "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json";
  const { stderr } = run(ffmpeg, [
    ...ffmpegOptions,
    "-i",
    video,
    "-map",
    "0:a:0",
    "-af",
    filter,
    "-f",
    "null",
    "-",
  ]);
  const json = stderr.toString().match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
  if (!json) throw new Error("FFmpeg did not report loudness.");
  const input = z
    .object({
      input_i: z.string(),
      input_tp: z.string(),
      input_lra: z.string(),
    })
    .parse(JSON.parse(json));
  const asNumber = (text) =>
    Number.isFinite(Number(text)) ? Number(text) : null;
  const integratedLufs = asNumber(input.input_i);
  return {
    integratedLufs,
    truePeakDbtp: asNumber(input.input_tp),
    loudnessRangeLu: integratedLufs === null ? null : asNumber(input.input_lra),
  };
}

function intervals(boundaries, duration) {
  const edges = [0, ...boundaries, duration];
  return edges.slice(1).map((end, index) => end - edges[index]);
}

function measurePacing(video, duration, annotatedBoundaries) {
  const filter = `scale=320:-2,select='gt(scene,${cutThreshold})',showinfo`;
  const { stderr } = run(ffmpeg, [
    ...ffmpegOptions,
    "-i",
    video,
    "-map",
    "0:V:0",
    "-an",
    "-vf",
    filter,
    "-f",
    "null",
    "-",
  ]);
  const cutTimes = [];
  for (const match of stderr
    .toString()
    .matchAll(
      /^\[Parsed_showinfo_[^\n]+\bn:\s*\d+[^\n]+\bpts_time:([\d.]+)/gm,
    )) {
    const time = Number(match[1]);
    if (
      time > (cutTimes.at(-1) ?? 0) + minimumCutGap &&
      time < duration - minimumCutGap
    ) {
      cutTimes.push(time);
    }
  }
  return {
    hardCutTimesSeconds: cutTimes,
    hardCutsPerMinute: round((cutTimes.length * 60) / duration),
    detectedShotLengthSeconds: cutTimes.length
      ? spread(intervals(cutTimes, duration))
      : null,
    annotatedScenes:
      annotatedBoundaries === undefined
        ? null
        : {
            boundariesSeconds: annotatedBoundaries,
            transitionsPerMinute: round(
              (annotatedBoundaries.length * 60) / duration,
            ),
            sceneLengthSeconds: spread(
              intervals(annotatedBoundaries, duration),
            ),
          },
  };
}

async function measureNarration(annotations, duration, measuredAudio) {
  if (measuredAudio?.integratedLufs == null) return null;
  let source;
  let text;
  if (annotations?.storyboard) {
    const storyboard = narrationSchema.parse(
      JSON.parse(await readFile(annotations.storyboard, "utf8")),
    );
    source = "storyboard";
    text = storyboard.scenes.map(({ narration }) => narration ?? "").join(" ");
  } else if (annotations?.transcript) {
    source = "transcript";
    text = await readFile(annotations.transcript, "utf8");
  } else {
    return null;
  }
  const words =
    text.match(
      /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’-][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu,
    )?.length ?? 0;
  return { source, words, wordsPerVideoMinute: round((words * 60) / duration) };
}

const linearChannel = Array.from({ length: 256 }, (_, index) => {
  const value = index / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

function estimateContrast(box, pixels, frame) {
  const edge = Math.max(2, Math.round(frame.height * 0.003));
  const left = Math.max(0, box.x - edge);
  const top = Math.max(0, box.y - edge);
  const right = Math.min(frame.width, box.x + box.width + edge);
  const bottom = Math.min(frame.height, box.y + box.height + edge);
  const inside = [];
  const border = [];
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const offset = (y * frame.width + x) * frame.channels;
      const luminance =
        0.2126 * linearChannel[pixels[offset]] +
        0.7152 * linearChannel[pixels[offset + 1]] +
        0.0722 * linearChannel[pixels[offset + 2]];
      const withinWord =
        x >= box.x &&
        x < box.x + box.width &&
        y >= box.y &&
        y < box.y + box.height;
      (withinWord ? inside : border).push(luminance);
    }
  }
  if (!inside.length || !border.length) return null;
  inside.sort((a, b) => a - b);
  border.sort((a, b) => a - b);
  const background = border[Math.floor(border.length / 2)] + 0.05;
  const dark = inside[Math.floor((inside.length - 1) * 0.1)] + 0.05;
  const light = inside[Math.floor((inside.length - 1) * 0.9)] + 0.05;
  return Math.max(background / dark, light / background, 1);
}

async function measureText(video, duration) {
  const frames = [];
  const heights = [];
  const contrasts = [];
  for (const fraction of sampleFractions) {
    const time = duration * fraction;
    const { stdout: image } = run(ffmpeg, [
      ...ffmpegOptions,
      "-v",
      "error",
      "-ss",
      String(time),
      "-i",
      video,
      "-map",
      "0:V:0",
      "-an",
      "-vf",
      "scale='min(iw,960)':-2",
      "-frames:v",
      "1",
      "-threads:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-",
    ]);
    if (!image.length) continue;
    const { stdout } = run(
      "tesseract",
      ["stdin", "stdout", "--psm", "11", "tsv"],
      image,
    );
    const { data, info } = await sharp(image)
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let wordBoxes = 0;
    for (const line of stdout.toString().split(/\r?\n/)) {
      const [level, , , , , , left, top, width, height, confidence, text] =
        line.split("\t");
      if (
        level !== "5" ||
        Number(confidence) < minimumOcrConfidence ||
        !/[\p{L}\p{N}]/u.test(text ?? "")
      )
        continue;
      const box = {
        x: Number(left),
        y: Number(top),
        width: Number(width),
        height: Number(height),
      };
      wordBoxes++;
      heights.push((box.height * 100) / info.height);
      const contrast = estimateContrast(box, data, info);
      if (contrast !== null) contrasts.push(contrast);
    }
    frames.push({ timeSeconds: round(time), wordBoxes });
  }
  return {
    frames,
    wordBoxHeightPercentOfFrame: spread(heights),
    estimatedContrastRatio: spread(contrasts),
  };
}

async function measureExport(file, annotations, ocr) {
  const video = path.resolve(file);
  const { stdout } = run(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type,width,height,duration:stream_disposition=attached_pic",
    "-of",
    "json",
    video,
  ]);
  const probe = probeSchema.parse(JSON.parse(stdout.toString()));
  const stream = probe.streams.find(
    ({ codec_type, disposition }) =>
      codec_type === "video" && !disposition?.attached_pic,
  );
  if (!stream) throw new Error("Expected a video stream.");
  const duration = [stream.duration, probe.format.duration]
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0);
  if (!duration) throw new Error("Expected a positive video duration.");
  const boundaries = annotations?.sceneBoundariesSeconds;
  if (
    boundaries?.some(
      (time, index) => time <= (boundaries[index - 1] ?? 0) || time >= duration,
    )
  ) {
    throw new Error(
      "Scene boundaries must be increasing and inside the video duration.",
    );
  }
  const audio = probe.streams.some(({ codec_type }) => codec_type === "audio")
    ? readLoudness(video)
    : null;
  return {
    file,
    durationSeconds: round(duration),
    resolution: { width: stream.width, height: stream.height },
    audio,
    pacing: measurePacing(video, duration, boundaries),
    narration: await measureNarration(annotations, duration, audio),
    typography: ocr ? await measureText(video, duration) : null,
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      annotations: { type: "string" },
      ocr: { type: "boolean" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: npm run quality:baseline -- [--annotations file.json] [--ocr] [--out report.json] video.mp4 [...]",
    );
    return;
  }
  if (!positionals.length)
    throw new Error("Supply at least one export path. Use --help for options.");
  const annotations = new Map(
    Object.entries(
      values.annotations
        ? annotationsSchema.parse(
            JSON.parse(await readFile(values.annotations, "utf8")),
          )
        : {},
    ).map(([file, entry]) => [path.resolve(file), entry]),
  );
  if (values.ocr) run("tesseract", ["--version"]);
  const exports = [];
  for (const file of positionals) {
    try {
      exports.push(
        await measureExport(
          file,
          annotations.get(path.resolve(file)),
          values.ocr,
        ),
      );
    } catch (error) {
      throw new Error(`${file}: ${error.message}`, { cause: error });
    }
  }
  const report = {
    method: {
      ffmpegSceneScoreThreshold: cutThreshold,
      minimumHardCutGapSeconds: minimumCutGap,
      ocr: values.ocr
        ? { sampleFractions, minimumWordConfidence: minimumOcrConfidence }
        : null,
    },
    exports,
  };
  const json = JSON.stringify(report, null, 2) + "\n";
  if (!values.out) {
    process.stdout.write(json);
    return;
  }
  await mkdir(path.dirname(values.out), { recursive: true });
  await writeFile(values.out, json);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
