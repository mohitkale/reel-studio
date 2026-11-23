import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import { getCharacter } from "@/engines/hyperframes/presenter/characters";
import { PRESENTER_PLACEMENTS } from "@/engines/hyperframes/presenter/build-presenter";
import { buildPresenterTrack } from "@/library/presenter-track";
import { presenterAdjustmentSchema } from "@/video/presenter-config-schema";
import { buildRecordingClipHtml } from "@/engines/hyperframes/build-recording-clip";
import { HYPERFRAMES_RENDER_FONT_FILES } from "@/engines/hyperframes/render-fonts";
import {
  fillerWordIndexes,
  planKeepSegments,
  remapWords,
  suggestClips,
  totalSeconds,
  type ClipSuggestion,
  type RecWord,
} from "@/lib/recording-clips";
import { buildShareCaption } from "@/lib/share-caption";
import { heardWordsFromWhisperJson } from "@/lib/word-alignment";
import { dtwPreset } from "@/library/take-word-alignment";
import { waveformEnvelope } from "@/library/podcast-audiogram";
import { cancelChild } from "@/library/production-cancellation";
import {
  getLocalTranscriptionStatus,
  runWhisper,
} from "@/library/local-transcription";
import { createAsset } from "@/library/repositories/assets";
import { getAssetStore } from "@/library/storage";
import { engineHome } from "@/server/local-engine";
import { getTheme } from "@/video/themes";
import { ProviderError } from "@/providers/voice/types";

const run = promisify(execFile);

export const MEDIA_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".opus",
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".m4v",
] as const;

export interface RecordingRecord {
  id: string;
  name: string;
  status: "transcribing" | "ready" | "failed";
  error?: string;
  createdAt: string;
  duration: number;
  hasVideo: boolean;
  width: number;
  height: number;
  language: string;
  words: RecWord[];
  /** The recording's own file, relative to its folder. */
  source: string;
}

export interface ClipResult {
  title: string;
  seconds: number;
  url: string;
  assetId: string;
  /** Title, description and hashtags for posting, from the clip's own words. */
  kit: { title: string; description: string; hashtags: string[] };
}

export interface ClipJob {
  state: "running" | "done" | "failed";
  total: number;
  finished: number;
  step: string;
  results: ClipResult[];
  error?: string;
}

const recordingsRoot = () => path.join(engineHome(), "recordings");
const folder = (id: string) => path.join(recordingsRoot(), id);

function validId(id: string): string {
  if (!/^[a-z0-9-]{8,40}$/.test(id))
    throw new ProviderError("Recording not found", 404);
  return id;
}

async function readRecord(id: string): Promise<RecordingRecord> {
  try {
    return JSON.parse(
      await fs.readFile(path.join(folder(validId(id)), "record.json"), "utf8"),
    );
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("Recording not found", 404);
  }
}
async function writeRecord(record: RecordingRecord) {
  await fs.writeFile(
    path.join(folder(record.id), "record.json"),
    JSON.stringify(record),
  );
}

export async function listRecordings(): Promise<
  Omit<RecordingRecord, "words">[]
> {
  let ids: string[] = [];
  try {
    ids = await fs.readdir(recordingsRoot());
  } catch {
    return [];
  }
  const records = await Promise.all(
    ids.map((id) => readRecord(id).catch(() => null)),
  );
  return records
    .flatMap((r) => (r ? [r] : []))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ words: _words, ...rest }) => {
      void _words;
      return rest;
    });
}

export async function getRecording(id: string): Promise<RecordingRecord> {
  return readRecord(id);
}

/** Readiness for the transcription steps, reported to the studio and to agents. */
export async function recordingReadiness() {
  const whisper = await getLocalTranscriptionStatus();
  let ffmpeg = true;
  try {
    await run("ffmpeg", ["-version"]);
  } catch {
    ffmpeg = false;
  }
  return {
    available: whisper.available && ffmpeg,
    reason: !ffmpeg
      ? "FFmpeg is not installed. Run doctor --fix."
      : (whisper.reason ?? null),
  };
}

async function probe(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height:format=duration",
    "-of",
    "json",
    file,
  ]);
  const json = JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const video = json.streams?.find(
    (s) => s.codec_type === "video" && (s.width ?? 0) > 0,
  );
  const duration = Number(json.format?.duration);
  if (!json.streams?.some((s) => s.codec_type === "audio"))
    throw new ProviderError("That file has no audio to transcribe.", 400);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new ProviderError("Could not read the length of that file.", 400);
  return {
    duration,
    hasVideo: Boolean(video),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
  };
}

/** Words whisper.cpp heard, with times in seconds. Ends are the next word's start, within reason. */
export async function transcribeAudio(
  wavPath: string,
  language: string,
): Promise<RecWord[]> {
  const status = await getLocalTranscriptionStatus();
  if (!status.available || !status.binary || !status.model)
    throw new ProviderError(
      status.reason ?? "Local transcription is not set up.",
      503,
    );
  const directory = await fs.mkdtemp(path.join(tmpdir(), "reel-transcribe-"));
  try {
    const base = path.join(directory, "words");
    const preset = dtwPreset(status.model);
    await runWhisper(status.binary, [
      "-m",
      status.model,
      "-f",
      wavPath,
      "-ojf",
      "-np",
      "-l",
      language,
      ...(preset ? ["-dtw", preset, "-nfa"] : []),
      "-of",
      base,
    ]);
    const heard = heardWordsFromWhisperJson(
      JSON.parse(await fs.readFile(`${base}.json`, "utf8")),
    );
    // whisper writes quotation marks as part of a word; captions look cleaner without them.
    const clean = heard
      .map((word) => ({
        ...word,
        text: word.text.replace(/^["“”«»]+|["“”«»]+$/g, ""),
      }))
      .filter((word) => word.text.length > 0);
    return clean.map((word, i) => {
      const heard = clean;
      const start = word.ms / 1000;
      const next = heard[i + 1] ? heard[i + 1]!.ms / 1000 : start + 0.5;
      return {
        text: word.text,
        start,
        end: Math.max(start + 0.08, Math.min(next, start + 1.2)),
      };
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

/**
 * Keep a recording in the studio's own folder and transcribe it in the
 * background. Nothing leaves this computer. The caller polls `getRecording`.
 */
export async function importRecording(input: {
  name: string;
  bytes?: Buffer;
  /** A file already on this computer (an agent passes a path). */
  sourcePath?: string;
  language?: string;
}): Promise<{ id: string }> {
  const extension = path
    .extname(input.name || input.sourcePath || "")
    .toLowerCase();
  if (!(MEDIA_EXTENSIONS as readonly string[]).includes(extension))
    throw new ProviderError(
      `Use an audio or video file (${MEDIA_EXTENSIONS.join(", ")}).`,
      400,
    );
  const ready = await recordingReadiness();
  if (!ready.available)
    throw new ProviderError(
      ready.reason ?? "Transcription is not set up.",
      503,
    );
  const id = randomUUID();
  await fs.mkdir(folder(id), { recursive: true, mode: 0o700 });
  const source = `source${extension}`;
  if (input.bytes)
    await fs.writeFile(path.join(folder(id), source), input.bytes);
  else if (input.sourcePath)
    await fs.copyFile(input.sourcePath, path.join(folder(id), source));
  else throw new ProviderError("Give a file or a path.", 400);
  let info;
  try {
    info = await probe(path.join(folder(id), source));
  } catch (error) {
    await fs.rm(folder(id), { recursive: true, force: true });
    throw error instanceof ProviderError
      ? error
      : new ProviderError(
          "That file could not be read as audio or video.",
          400,
        );
  }
  const record: RecordingRecord = {
    id,
    name: path.basename(input.name || input.sourcePath || source),
    status: "transcribing",
    createdAt: new Date().toISOString(),
    language: input.language?.trim() || "auto",
    words: [],
    source,
    ...info,
  };
  await writeRecord(record);
  void (async () => {
    try {
      const wav = path.join(folder(id), "audio16k.wav");
      await run("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-i",
        path.join(folder(id), source),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        wav,
      ]);
      const words = await transcribeAudio(wav, record.language);
      if (words.length === 0)
        throw new Error("No speech was found in the recording.");
      await writeRecord({ ...record, status: "ready", words });
    } catch (error) {
      await writeRecord({
        ...record,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
  return { id };
}

/** The loudness of a span of the recording from its 16 kHz copy, 0 to 1. */
async function energyFunction(
  id: string,
): Promise<((start: number, end: number) => number) | undefined> {
  try {
    const wav = await fs.readFile(path.join(folder(id), "audio16k.wav"));
    const bins = 200;
    const envelope = waveformEnvelope(wav, bins);
    const sorted = [...envelope].sort((a, b) => a - b);
    const high = sorted[Math.floor(sorted.length * 0.9)] || 1;
    const record = await readRecord(id);
    return (start, end) => {
      const from = Math.max(0, Math.floor((start / record.duration) * bins));
      const to = Math.min(
        bins,
        Math.max(from + 1, Math.ceil((end / record.duration) * bins)),
      );
      const slice = envelope.slice(from, to);
      const mean = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
      return Math.min(1, mean / high);
    };
  } catch {
    return undefined;
  }
}

export async function suggestRecordingClips(
  id: string,
  count = 3,
): Promise<ClipSuggestion[]> {
  const record = await readRecord(id);
  if (record.status !== "ready") return [];
  return suggestClips(record.words, {
    count,
    energy: await energyFunction(id),
  });
}

export const clipRequestSchema = z
  .object({
    clips: z
      .array(
        z.object({
          startWord: z.number().int().min(0),
          endWord: z.number().int().min(0),
          title: z.string().trim().min(1).max(80).optional(),
        }),
      )
      .min(1)
      .max(10),
    /** Word indexes deleted in the transcript view; their audio and video are cut. */
    removed: z.array(z.number().int().min(0)).max(50_000).default([]),
    trimSilence: z.boolean().default(false),
    removeFillers: z.boolean().default(false),
    format: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
    reframe: z.enum(["fill", "blur"]).default("blur"),
    theme: z.string().max(40).optional(),
    /** An animated presenter that speaks the clip with lip sync. */
    presenter: z
      .object({
        character: z.string().max(20),
        placement: z.enum(PRESENTER_PLACEMENTS as [string, ...string[]]),
        adjustment: presenterAdjustmentSchema.optional(),
      })
      .optional(),
    quality: z.enum(["draft", "standard", "high"]).default("standard"),
  })
  .strict();
export type ClipRequest = z.infer<typeof clipRequestSchema>;

const FORMAT_SIZE = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
} as const;
const FPS = 30;

const jobsKey = "__reelRecordingJobs" as const;
function jobs(): Map<string, ClipJob> {
  const holder = globalThis as unknown as Record<string, Map<string, ClipJob>>;
  holder[jobsKey] ??= new Map();
  return holder[jobsKey];
}
export const getClipJob = (id: string): ClipJob | undefined =>
  jobs().get(validId(id));

async function spawnRender(directory: string, output: string, quality: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.resolve("scripts/hyperframes-render-worker.mjs"),
        directory,
        output,
        String(FPS),
        quality,
      ],
      {
        detached: process.platform !== "win32",
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
      },
    );
    const wait = cancelChild(child);
    let error = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (error.length < 65_536) error += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", async (code) => {
      await wait().catch(() => undefined);
      if (code === 0) resolve();
      else reject(new Error(`Clip export failed: ${error.slice(-1500)}`));
    });
  });
}

/** Cut the kept segments out of the source into one file with the video and the audio in step. */
async function cutMedia(
  source: string,
  segments: Array<{ start: number; end: number }>,
  hasVideo: boolean,
  directory: string,
  size: { width: number; height: number },
  reframe: "fill" | "blur",
) {
  // "fill" crops to the frame here; "blur" keeps the whole picture and lets the
  // composition show it over a blurred copy of itself.
  const fit =
    reframe === "fill"
      ? `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height}`
      : `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const parts = segments.map((s, i) => {
    const t = `start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)}`;
    return (
      (hasVideo
        ? `[0:v]trim=${t},setpts=PTS-STARTPTS,${fit},fps=${FPS},setsar=1[v${i}];`
        : "") + `[0:a]atrim=${t},asetpts=PTS-STARTPTS,aresample=44100[a${i}];`
    );
  });
  const inputs = segments
    .map((_, i) => (hasVideo ? `[v${i}][a${i}]` : `[a${i}]`))
    .join("");
  const graph = `${parts.join("")}${inputs}concat=n=${segments.length}:v=${hasVideo ? 1 : 0}:a=1${hasVideo ? "[v][a]" : "[a]"}`;
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    source,
    "-filter_complex",
    graph,
    ...(hasVideo
      ? [
          "-map",
          "[v]",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          path.join(directory, "clip.mp4"),
          "-map",
          "[a]",
        ]
      : ["-map", "[a]"]),
    "-c:a",
    "pcm_s16le",
    "-ar",
    "44100",
    path.join(directory, "audio.wav"),
  ]);
}

/**
 * Make the chosen clips. The cut is planned from the transcript (deleted words,
 * fillers, long pauses), the media is cut once with FFmpeg, and HyperFrames
 * exports the MP4 with a hook card and word-synced captions. Runs in the
 * background; poll `getClipJob`.
 */
export async function startClips(
  id: string,
  rawRequest: unknown,
): Promise<ClipJob> {
  const request = clipRequestSchema.parse(rawRequest);
  const record = await readRecord(id);
  if (record.status !== "ready")
    throw new ProviderError("The recording is not ready yet.", 409);
  const existing = jobs().get(id);
  if (existing?.state === "running") return existing;
  for (const clip of request.clips)
    if (clip.endWord < clip.startWord || clip.endWord >= record.words.length)
      throw new ProviderError(
        "A clip's words are outside the transcript.",
        400,
      );
  const job: ClipJob = {
    state: "running",
    total: request.clips.length,
    finished: 0,
    step: "Starting",
    results: [],
  };
  jobs().set(id, job);
  void (async () => {
    const size = FORMAT_SIZE[request.format];
    const theme = getTheme(request.theme) ?? getTheme("bold-pop")!;
    const removed = new Set(request.removed);
    const sourcePath = path.join(folder(id), record.source);
    try {
      for (const [index, clip] of request.clips.entries()) {
        const range = { startWord: clip.startWord, endWord: clip.endWord };
        const segments = planKeepSegments(record.words, range, {
          trimSilence: request.trimSilence,
          removeFillers: request.removeFillers,
          removed,
        });
        if (segments.length === 0)
          throw new Error(
            `Clip ${index + 1} has no words left after the cuts.`,
          );
        const fillerRemoved = request.removeFillers
          ? new Set([...removed, ...fillerWordIndexes(record.words)])
          : removed;
        const words = remapWords(record.words, segments, range, fillerRemoved);
        const seconds = totalSeconds(segments);
        const directory = await fs.mkdtemp(path.join(tmpdir(), "reel-clip-"));
        try {
          job.step = `Clip ${index + 1} of ${job.total}: cutting`;
          await cutMedia(
            sourcePath,
            segments,
            record.hasVideo,
            directory,
            size,
            request.reframe,
          );
          const runtime = path.join(directory, "_runtime");
          await fs.mkdir(runtime, { recursive: true });
          await Promise.all([
            fs.copyFile(
              path.resolve("node_modules/gsap/dist/gsap.min.js"),
              path.join(runtime, "gsap.min.js"),
            ),
            fs.copyFile(
              path.resolve(
                "node_modules/@fontsource-variable/geist/files",
                HYPERFRAMES_RENDER_FONT_FILES.sans,
              ),
              path.join(runtime, "geist.woff2"),
            ),
          ]);
          const wav = await fs.readFile(path.join(directory, "audio.wav"));
          const character = getCharacter(request.presenter?.character);
          if (request.presenter && !character)
            throw new Error(
              `Unknown presenter "${request.presenter.character}"`,
            );
          const presenterProps =
            request.presenter && character
              ? {
                  character,
                  placement: request.presenter.placement as
                    "full" | "corner" | "split",
                  adjustment: request.presenter.adjustment,
                  track: await buildPresenterTrack({
                    words,
                    wav,
                    seconds,
                    seed: `${id}:${index}`,
                    language: record.language,
                  }),
                }
              : undefined;
          const title =
            clip.title ??
            words
              .slice(0, 9)
              .map((w) => w.text)
              .join(" ");
          await fs.writeFile(
            path.join(directory, "index.html"),
            buildRecordingClipHtml({
              title,
              ...size,
              fps: FPS,
              durationSeconds: seconds,
              hasVideo: record.hasVideo,
              reframe: request.reframe,
              words,
              waveform: waveformEnvelope(wav, 48),
              presenter: presenterProps ?? undefined,
              colors: {
                background: theme.palette.background,
                foreground: theme.palette.foreground,
                accent: theme.palette.accent,
                accentForeground: theme.palette.accentForeground,
                muted: theme.palette.muted,
              },
            }),
          );
          job.step = `Clip ${index + 1} of ${job.total}: exporting`;
          const output = path.join(directory, "out.mp4");
          await spawnRender(directory, output, request.quality);
          const storeKey = `assets/clips/${id}-${index + 1}-${randomUUID().slice(0, 8)}.mp4`;
          await getAssetStore().put(storeKey, await fs.readFile(output));
          const text = words.map((w) => w.text).join(" ");
          const share = buildShareCaption({
            title,
            scenes: [{ narration: text }],
          });
          const asset = await createAsset(
            "video",
            storeKey,
            `Clip: ${title}`.slice(0, 80),
            {
              recording: id,
              clip: index + 1,
              seconds,
            },
          );
          job.results.push({
            title,
            seconds,
            url: asset.url,
            assetId: asset.id,
            kit: {
              title,
              description: text.slice(0, 280),
              hashtags: share.hashtags,
            },
          });
          job.finished++;
        } finally {
          await fs.rm(directory, { recursive: true, force: true });
        }
      }
      job.state = "done";
      job.step = "Done";
    } catch (error) {
      job.state = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
  })();
  return job;
}

export async function deleteRecording(id: string): Promise<void> {
  await fs.rm(folder(validId(id)), { recursive: true, force: true });
  jobs().delete(id);
}
