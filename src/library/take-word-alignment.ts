/**
 * Word timing for a narrated take, from the audio itself (roadmap V4b).
 *
 * Voices that report no word times (Kokoro) leave captions with a length-based
 * estimate that can be a few hundred milliseconds off. When whisper.cpp is
 * installed, listening to the take gives each word its own time. Without it,
 * or when a scene's words cannot be matched, the caller keeps its estimate.
 */
import { mediaDirectory } from "@/library/storage/media-directory";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  getLocalTranscriptionStatus,
  runWhisper,
} from "@/library/local-transcription";
import { speechSpansFromWav } from "@/lib/speech-spans";
import {
  alignSceneWords,
  heardWordsFromWhisperJson,
  type HeardWord,
  type TimedWord,
} from "@/lib/word-alignment";

const run = promisify(execFile);

export interface AlignableTake {
  audioUrl: string;
  fps: number;
  timeline: Array<{
    sceneId: string;
    text: string;
    startFrame: number;
    durationFrames: number;
    words?: unknown;
  }>;
}

const DTW_MODELS = new Set([
  "tiny",
  "tiny.en",
  "base",
  "base.en",
  "small",
  "small.en",
  "medium",
  "medium.en",
  "large.v1",
  "large.v2",
  "large.v3",
]);

/** whisper.cpp's `-dtw` preset for a model file such as ggml-small.en.bin. */
export function dtwPreset(modelPath: string): string | null {
  const name = path
    .basename(modelPath)
    .replace(/^ggml-/, "")
    .replace(/\.bin$/, "")
    .replace(/-q\d.*$/, "")
    .replace(/^large-v(\d)/, "large.v$1");
  return DTW_MODELS.has(name) ? name : null;
}

/**
 * Words whisper.cpp heard in a WAV file, with token-level (dtw) times when the
 * model supports them. Null when whisper.cpp is not installed.
 */
export async function hearWav(
  audioPath: string,
  modelOverride?: string,
): Promise<HeardWord[] | null> {
  const status = await getLocalTranscriptionStatus();
  if (!status.available || !status.binary || !status.model) return null;
  const model = modelOverride ?? status.model;
  const directory = await mkdtemp(path.join(tmpdir(), "reel-align-"));
  try {
    const input = path.join(directory, "voice.wav");
    await run("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      audioPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      input,
    ]);
    const base = path.join(directory, "words");
    const preset = dtwPreset(model);
    await runWhisper(status.binary, [
      "-m",
      model,
      "-f",
      input,
      "-ojf",
      "-np",
      // DTW needs flash attention off in whisper.cpp.
      ...(preset ? ["-dtw", preset, "-nfa"] : []),
      "-of",
      base,
    ]);
    return heardWordsFromWhisperJson(
      JSON.parse(await readFile(`${base}.json`, "utf8")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Frame timing for the words of every scene that could be matched, keyed by
 * scene id. Empty when whisper.cpp is unavailable or the take is not local.
 */
export async function alignTakeWords(
  take: AlignableTake,
): Promise<Map<string, TimedWord[]>> {
  const result = new Map<string, TimedWord[]>();
  if (!take.audioUrl.startsWith("/media/")) return result;
  const audioPath = path.join(mediaDirectory(), take.audioUrl.slice(7));
  const wav = await readFile(audioPath);
  const heard = await hearWav(audioPath);
  if (!heard?.length) return result;
  const spans = speechSpansFromWav(wav);
  let from = 0;
  for (const beat of take.timeline) {
    const words = beat.text.replace(/\s+/g, " ").trim().split(" ");
    if (!words[0]) continue;
    const aligned = alignSceneWords({
      words,
      heard,
      from,
      fps: take.fps,
      sceneStartFrame: beat.startFrame,
      sceneEndFrame: beat.startFrame + beat.durationFrames,
      spans,
    });
    if (!aligned) continue;
    from = aligned.next;
    result.set(beat.sceneId, aligned.words);
  }
  return result;
}
