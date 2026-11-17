/**
 * `npm run captions:verify`: how far word highlight timing is from the spoken
 * word (roadmap V4b). For each narrated video of the showcase it takes the
 * voice take, builds the same automatic caption track a final export uses
 * (words timed by whisper.cpp with token-level DTW times when it is installed),
 * then compares every caption word with a reference from a second, different
 * whisper model, and reports five spot-checked words per video.
 *
 * Why a second model: plain whisper token offsets differ by about 200 ms between
 * models, but DTW times from two models agree within 80 ms for most words, so
 * agreement between them is evidence the time is where the word was spoken.
 *
 * Reads the local database (the app need not run). Needs `ffmpeg` and whisper.cpp
 * (`WHISPER_CPP_BIN` or `whisper-cli` on PATH). `WHISPER_CPP_MODEL` times the
 * captions; `--reference <model file>` (default: ggml-medium.en.bin in
 * ~/.cache/hyperframes/whisper/models) is the yardstick.
 *
 *   npm run captions:verify [-- --only listicle,story] [--estimate]
 *
 * `--estimate` measures the length-based estimate drafts use instead.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { buildAutoCaptionTrack } from "../src/library/auto-captions";
import { prisma } from "../src/library/db";
import { getScript } from "../src/library/repositories/scripts";
import { alignTakeWords, hearWav } from "../src/library/take-word-alignment";
import { EXAMPLES_DIR } from "../src/storyboard/examples-check";

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = value("--only")?.split(",");
const estimateOnly = args.includes("--estimate");
const reference =
  value("--reference") ??
  path.join(
    homedir(),
    ".cache",
    "hyperframes",
    "whisper",
    "models",
    "ggml-medium.en.bin",
  );
const SPOT_CHECKS = 5;
const LIMIT_MS = 80;

const norm = (word: string) =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

interface Measured {
  word: string;
  errorMs: number;
}

function matchWords(
  ours: Array<{ text: string; ms: number }>,
  heard: Array<{ text: string; ms: number }>,
): Measured[] {
  const out: Measured[] = [];
  let cursor = 0;
  for (const word of ours) {
    const n = norm(word.text);
    if (!n) continue;
    for (let i = cursor; i < Math.min(heard.length, cursor + 4); i++) {
      if (norm(heard[i]!.text) === n) {
        out.push({ word: word.text, errorMs: word.ms - heard[i]!.ms });
        cursor = i + 1;
        break;
      }
    }
  }
  return out;
}

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

async function main() {
  if (!existsSync(reference))
    throw new Error(
      `Reference model not found: ${reference} (pass --reference <ggml model>)`,
    );
  const examples = (await readdir(EXAMPLES_DIR))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  const report: Array<Record<string, unknown>> = [];
  let allPass = true;
  for (const name of examples) {
    if (only && !only.includes(name)) continue;
    const title = (
      JSON.parse(
        await readFile(path.join(EXAMPLES_DIR, `${name}.json`), "utf8"),
      ) as { title: string }
    ).title;
    const project = await prisma.project.findFirst({
      where: { name: title, scripts: { some: { takes: { some: {} } } } },
      orderBy: { createdAt: "desc" },
      include: { scripts: { where: { takes: { some: {} } }, take: 1 } },
    });
    const scriptId = project?.scripts[0]?.id;
    if (!project || !scriptId) {
      console.log(
        `- ${name}: no project titled "${title}" (run npm run showcase)`,
      );
      continue;
    }
    const script = await getScript(scriptId);
    const take = script?.takes[0];
    if (!take) continue;
    const audioPath = path.join(
      "media",
      take.audioUrl.replace(/^\/media\//, ""),
    );

    const aligned = estimateOnly
      ? new Map()
      : await alignTakeWords(take as never);
    const timeline = take.timeline.map((beat) =>
      aligned.has(beat.sceneId)
        ? { ...beat, words: aligned.get(beat.sceneId) }
        : beat,
    );
    const track = buildAutoCaptionTrack({
      scriptId: "verify",
      take: { ...take, timeline } as never,
    });
    const ours = (track?.cues ?? []).flatMap((cue) =>
      (cue.words ?? []).map((w) => ({
        text: w.text,
        ms: (w.startFrame / take.fps) * 1000,
      })),
    );
    const heard = await hearWav(audioPath, reference);
    if (!heard) throw new Error("whisper.cpp is not available");
    const measured = matchWords(ours, heard);
    const errors = measured
      .map((m) => Math.abs(m.errorMs))
      .sort((a, b) => a - b);
    const spots = Array.from(
      { length: SPOT_CHECKS },
      (_, i) =>
        measured[Math.floor(((i + 0.5) / SPOT_CHECKS) * measured.length)],
    ).filter((m): m is Measured => Boolean(m));
    const spotPass = spots.filter(
      (m) => Math.abs(m.errorMs) <= LIMIT_MS,
    ).length;
    if (spotPass < spots.length) allPass = false;
    const row = {
      example: name,
      timing: estimateOnly
        ? "length estimate"
        : `whisper aligned ${aligned.size}/${take.timeline.length} scenes`,
      matched: `${measured.length}/${ours.length}`,
      medianMs: Math.round(pct(errors, 0.5)),
      p90Ms: Math.round(pct(errors, 0.9)),
      within80: `${Math.round((errors.filter((e) => e <= LIMIT_MS).length / Math.max(1, errors.length)) * 100)}%`,
      spots: `${spotPass}/${spots.length} within ${LIMIT_MS} ms`,
    };
    report.push(row);
    console.log(JSON.stringify(row));
  }
  if (!only)
    await writeFile(
      path.join("docs", "quality", "caption-timing.json"),
      `${JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), limitMs: LIMIT_MS, mode: estimateOnly ? "estimate" : "aligned", rows: report }, null, 2)}\n`,
    );
  console.log(
    allPass ? "All spot checks within 80 ms" : "Some spot checks exceed 80 ms",
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
