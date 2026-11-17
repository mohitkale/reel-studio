/**
 * Word timing for a narrated take, from the audio itself (roadmap V4b).
 *
 * Voices that report no word times (Kokoro) leave captions with a length-based
 * estimate that can be a few hundred milliseconds off. When whisper.cpp is
 * installed, listening to the take gives each word its own time. Without it,
 * or when a scene's words cannot be matched, the caller keeps its estimate.
 */
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

/** Words the recogniser heard in a local take. Null when it cannot run. */
async function hearTake(audioPath: string): Promise<HeardWord[] | null> {
  const status = await getLocalTranscriptionStatus();
  if (!status.available || !status.binary || !status.model) return null;
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
    await runWhisper(status.binary, [
      "-m",
      status.model,
      "-f",
      input,
      "-ojf",
      "-np",
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
  const audioPath = path.join(process.cwd(), "media", take.audioUrl.slice(7));
  const wav = await readFile(audioPath);
  const heard = await hearTake(audioPath);
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
