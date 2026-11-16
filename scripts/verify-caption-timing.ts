/**
 * `npm run captions:verify`: how far word highlight timing is from the spoken
 * word (roadmap V4b). For each narrated video of the showcase it takes the
 * voice take, builds the same automatic caption track the export uses, runs
 * whisper.cpp on the audio for reference word times, and reports the error of
 * every caption word plus five spot-checked words per video.
 *
 * Reads the local database (the app need not run), and needs `ffmpeg` and
 * whisper.cpp (`WHISPER_CPP_BIN` or `whisper-cli` on PATH, `WHISPER_CPP_MODEL`).
 * Whisper's own word times are good to about 50 to 100 ms, so the reference is
 * a yardstick, not a guarantee.
 *
 *   npm run captions:verify [-- --only listicle,story]
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { buildAutoCaptionTrack } from "../src/library/auto-captions";
import { prisma } from "../src/library/db";
import { speechSpansFromPcm } from "../src/lib/speech-spans";
import { parseWav } from "../src/lib/wav";
import { getScript } from "../src/library/repositories/scripts";
import { EXAMPLES_DIR } from "../src/storyboard/examples-check";
import { readdir } from "node:fs/promises";

const run = promisify(execFile);
const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = value("--only")?.split(",");
const SPOT_CHECKS = 5;
const LIMIT_MS = 80;

const norm = (word: string) =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

async function whisperWords(
  wav: string,
): Promise<Array<{ text: string; ms: number }>> {
  const binary = process.env.WHISPER_CPP_BIN?.trim() || "whisper-cli";
  const model = process.env.WHISPER_CPP_MODEL?.trim();
  if (!model)
    throw new Error("Set WHISPER_CPP_MODEL to a whisper.cpp model file");
  const dir = await mkdtemp(path.join(tmpdir(), "reel-cap-"));
  try {
    const out = path.join(dir, "words");
    await run(binary, ["-m", model, "-f", wav, "-ojf", "-np", "-of", out], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const json = JSON.parse(await readFile(`${out}.json`, "utf8")) as {
      transcription: Array<{
        tokens?: Array<{ text: string; offsets?: { from: number } }>;
      }>;
    };
    // A word starts at a token with a leading space; later tokens extend it.
    const words: Array<{ text: string; ms: number }> = [];
    for (const segment of json.transcription)
      for (const token of segment.tokens ?? []) {
        if (!token.offsets || /^\[_.*_\]$/.test(token.text)) continue;
        if (/^\s/.test(token.text) || !words.length) {
          if (token.text.trim())
            words.push({ text: token.text.trim(), ms: token.offsets.from });
        } else words[words.length - 1]!.text += token.text;
      }
    return words.filter((w) => norm(w.text));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface Measured {
  word: string;
  errorMs: number;
  /** The reference time of the word, in milliseconds. */
  refMs: number;
}

function matchWords(
  ours: Array<{ text: string; ms: number }>,
  reference: Array<{ text: string; ms: number }>,
): Measured[] {
  const out: Measured[] = [];
  let cursor = 0;
  for (const word of ours) {
    const n = norm(word.text);
    if (!n) continue;
    for (let i = cursor; i < Math.min(reference.length, cursor + 4); i++) {
      if (norm(reference[i]!.text) === n) {
        out.push({
          word: word.text,
          errorMs: word.ms - reference[i]!.ms,
          refMs: reference[i]!.ms,
        });
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
      ) as {
        title: string;
      }
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
    if (!script) continue;
    const take = script.takes[0];
    if (!take) continue;
    const dir = await mkdtemp(path.join(tmpdir(), "reel-cap-wav-"));
    try {
      const wav = path.join(dir, "voice.wav");
      await run("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-i",
        path.join("media", take.audioUrl.replace(/^\/media\//, "")),
        "-ar",
        "16000",
        "-ac",
        "1",
        wav,
      ]);
      const wavBytes = await readFile(
        path.join("media", take.audioUrl.replace(/^\/media\//, "")),
      );
      const info = parseWav(wavBytes);
      const speech = speechSpansFromPcm(
        new Int16Array(
          wavBytes.buffer.slice(
            wavBytes.byteOffset + info.dataOffset,
            wavBytes.byteOffset + info.dataOffset + (info.dataLength & ~1),
          ),
        ),
        info.sampleRate,
      );
      const track = buildAutoCaptionTrack({
        scriptId: "verify",
        take: take as never,
      });
      const ours = (track?.cues ?? []).flatMap((cue) =>
        (cue.words ?? []).map((w) => ({
          text: w.text,
          ms: (w.startFrame / take.fps) * 1000,
        })),
      );
      const everything = matchWords(ours, await whisperWords(wav));
      // Whisper dates the first word after a pause from the end of the
      // previous one, so those words are not a fair yardstick; compare the
      // words well inside a stretch of speech.
      const spanList = speech ?? [];
      const measured = everything.filter((m) =>
        spanList.some(
          ([a, b]) => m.refMs / 1000 >= a + 0.25 && m.refMs / 1000 <= b,
        ),
      );
      if (args.includes("--detail"))
        console.log(
          measured
            .slice(25, 70)
            .map(
              (m) =>
                `${m.word}:${(m.refMs / 1000).toFixed(2)}${m.errorMs >= 0 ? "+" : ""}${Math.round(m.errorMs)}`,
            )
            .join(" "),
        );
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
        timing: track?.timingSource,
        matched: `${measured.length}/${everything.length}/${ours.length}`,
        medianMs: Math.round(pct(errors, 0.5)),
        p90Ms: Math.round(pct(errors, 0.9)),
        within80: `${Math.round((errors.filter((e) => e <= LIMIT_MS).length / Math.max(1, errors.length)) * 100)}%`,
        spots: `${spotPass}/${spots.length} within ${LIMIT_MS} ms`,
      };
      report.push(row);
      console.log(JSON.stringify(row));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  await writeFile(
    path.join("docs", "quality", "caption-timing.json"),
    `${JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), limitMs: LIMIT_MS, rows: report }, null, 2)}\n`,
  );
  console.log(
    allPass ? "All spot checks within 80 ms" : "Some spot checks exceed 80 ms",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
