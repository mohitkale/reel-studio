import { randomUUID } from "node:crypto";

import type { PodcastTakeDTO } from "@/lib/dto";
import { stitchBeats, type BeatInput } from "@/lib/audio-timing";
import {
  analyzeWav,
  finalizeSpeechWav,
  transcodeAudioToWav,
  transcodeWavToMp3,
} from "@/lib/audio-production";
import { getProvider } from "@/providers/voice/registry";
import {
  ProviderError,
  type ProviderId,
  type SynthOptions,
  type SynthResult,
} from "@/providers/voice/types";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { createPodcastTake } from "@/library/repositories/podcasts";
import {
  PODCAST_BUMPER_SECONDS,
  podcastPronunciationsSchema,
  type PodcastBeatTiming,
  type PodcastFinishingSnapshot,
} from "@/library/podcast-schemas";
import {
  getCachedPodcastTurnWav,
  setCachedPodcastTurnWav,
} from "@/library/podcast-audio-cache";
import {
  derivePodcastChapters,
  resolvePodcastPreset,
} from "@/library/podcast-presets";
import { parseJsonColumn } from "@/library/schemas";
import {
  applyPodcastPronunciations,
  assemblePodcastMaster,
} from "@/library/podcast-finishing";

export type PodcastTakeProgress =
  | {
      phase: "synthesizing";
      scene: number;
      sceneCount: number;
      workingOn?: number;
      cached: number;
      generated: number;
    }
  | { phase: "stitching"; scene: number; sceneCount: number };

export interface GeneratePodcastTakeInput {
  podcastId: string;
  label?: string;
  /** Bypass the cache only for these turns; all other exact matches are reused. */
  regenerateTurnIds?: string[];
  onProgress?: (progress: PodcastTakeProgress) => void;
}

const DEFAULT_SYNTH_CONCURRENCY = 4;
const DEFAULT_FPS = 30;

type TurnJob = {
  index: number;
  turnId: string;
  text: string;
  spokenText: string;
  pauseAfterSeconds: number | null;
  characterKey: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  podcastId: string;
};

/**
 * Synthesize each turn with its character's voice (bounded concurrency),
 * then return beats in original turn order for stitching.
 */
async function synthesizeTurnsConcurrently(
  jobs: TurnJob[],
  maxConcurrency: number,
  forceTurnIds: ReadonlySet<string>,
  onProgress?: (
    done: number,
    total: number,
    workingOn: number | undefined,
    cached: number,
    generated: number,
  ) => void,
): Promise<{
  beats: BeatInput[];
  keys: string[];
  cached: number;
  generated: number;
}> {
  const total = jobs.length;
  const results: BeatInput[] = new Array(total);
  const keys: string[] = new Array(total);
  let cursor = 0;
  let completed = 0;
  let cached = 0;
  let generated = 0;

  // Group by provider so we can reuse the same synth function.
  const providerCache = new Map<
    string,
    (opts: SynthOptions) => Promise<SynthResult>
  >();

  function getSynth(providerId: string) {
    let synth = providerCache.get(providerId);
    if (synth) return synth;
    const provider = getProvider(providerId as ProviderId);
    if (provider.runtime === "client" || !provider.synth) {
      throw new ProviderError(
        `${provider.label} runs in your browser. Pick a server voice provider for podcast generation (or use Kokoro Server).`,
        400,
        providerId as ProviderId,
      );
    }
    if (!provider.isConfigured()) {
      throw new ProviderError(
        providerId === "voiceforge"
          ? `${provider.label} is not configured. Set VOICEFORGE_SERVICE_URL in .env.local.`
          : `${provider.label} has no API key. Add one in Settings.`,
        400,
        providerId as ProviderId,
      );
    }
    synth = provider.synth;
    providerCache.set(providerId, synth);
    return synth;
  }

  async function worker() {
    while (cursor < jobs.length) {
      const i = cursor++;
      const job = jobs[i];
      const cacheKey = {
        podcastId: job.podcastId,
        turnId: job.turnId,
        providerId: job.providerId,
        voiceId: job.voiceId,
        modelId: job.modelId,
        text: job.spokenText,
      };
      let wav = forceTurnIds.has(job.turnId)
        ? null
        : await getCachedPodcastTurnWav(cacheKey);
      if (wav) {
        cached += 1;
      } else {
        onProgress?.(completed, total, i + 1, cached, generated);
        const synth = getSynth(job.providerId);
        const result = await synth({
          voiceId: job.voiceId,
          modelId: job.modelId,
          text: job.spokenText,
        });
        wav = result.wav;
        await setCachedPodcastTurnWav(cacheKey, wav).catch(() => undefined);
        generated += 1;
      }
      results[i] = {
        sceneId: job.turnId,
        text: job.text,
        wav,
      };
      keys[i] = job.characterKey;
      completed += 1;
      onProgress?.(completed, total, undefined, cached, generated);
    }
  }

  const concurrency = Math.min(maxConcurrency, jobs.length || 1);
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { beats: results, keys, cached, generated };
}

/**
 * Generate a full podcast take: per-character-voice TTS per turn (parallel),
 * then stitch in turn order so dialogue sequence is preserved.
 */
export async function generatePodcastTake(
  input: GeneratePodcastTakeInput,
): Promise<PodcastTakeDTO> {
  const podcast = await prisma.podcast.findUnique({
    where: { id: input.podcastId },
    include: {
      characters: { orderBy: { order: "asc" } },
      turns: {
        orderBy: { order: "asc" },
        include: { character: true },
      },
    },
  });
  if (!podcast) throw new ProviderError("Podcast not found", 404);
  if (podcast.turns.length === 0) {
    throw new ProviderError(
      "Add a script (AI or JSON) before generating audio",
      400,
    );
  }

  const pronunciations = parseJsonColumn(
    podcast.pronunciationsJson,
    podcastPronunciationsSchema,
    [],
  );

  async function loadBumper(
    assetId: string | null,
    position: "intro" | "outro",
  ) {
    if (!assetId) return null;
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.type !== "audio") {
      throw new ProviderError(
        `Assigned ${position} music asset is unavailable`,
        409,
      );
    }
    const bytes = await getAssetStore()
      .get(asset.path)
      .catch(() => null);
    if (!bytes) {
      throw new ProviderError(
        `Assigned ${position} music file is missing`,
        409,
      );
    }
    const wav = await transcodeAudioToWav(bytes, {
      maxSeconds: PODCAST_BUMPER_SECONDS,
    });
    return {
      wav,
      snapshot: {
        assetId: asset.id,
        name: asset.name ?? `${position} music`,
        durationSeconds: analyzeWav(wav).durationSeconds,
      },
    };
  }

  // Validate local finishing media before any potentially paid provider call.
  const [intro, outro] = await Promise.all([
    loadBumper(podcast.introMusicAssetId, "intro"),
    loadBumper(podcast.outroMusicAssetId, "outro"),
  ]);

  const jobs: TurnJob[] = podcast.turns.map((t, index) => {
    const c = t.character;
    if (!c.providerId || !c.voiceId) {
      throw new ProviderError(
        `Pick a voice for character "${c.name}" before generating`,
        400,
      );
    }
    return {
      index,
      turnId: t.id,
      text: t.text,
      spokenText: applyPodcastPronunciations(t.text, pronunciations),
      pauseAfterSeconds: t.pauseAfterSeconds,
      characterKey: c.key,
      providerId: c.providerId,
      voiceId: c.voiceId,
      modelId: c.modelId ?? undefined,
      podcastId: podcast.id,
    };
  });

  // Use the lowest maxConcurrency among involved providers.
  let maxConcurrency = DEFAULT_SYNTH_CONCURRENCY;
  for (const job of jobs) {
    const p = getProvider(job.providerId as ProviderId);
    if (p.maxConcurrency != null) {
      maxConcurrency = Math.min(maxConcurrency, p.maxConcurrency);
    }
  }

  const turnCount = jobs.length;
  const knownTurnIds = new Set(jobs.map((job) => job.turnId));
  const forceTurnIds = new Set(input.regenerateTurnIds ?? []);
  for (const turnId of forceTurnIds) {
    if (!knownTurnIds.has(turnId)) {
      throw new ProviderError(`Podcast turn not found: ${turnId}`, 400);
    }
  }
  input.onProgress?.({
    phase: "synthesizing",
    scene: 0,
    sceneCount: turnCount,
    cached: 0,
    generated: 0,
  });

  const { beats, keys, cached, generated } = await synthesizeTurnsConcurrently(
    jobs,
    maxConcurrency,
    forceTurnIds,
    (done, total, workingOn, cachedCount, generatedCount) =>
      input.onProgress?.({
        phase: "synthesizing",
        scene: done,
        sceneCount: total,
        workingOn,
        cached: cachedCount,
        generated: generatedCount,
      }),
  );

  input.onProgress?.({
    phase: "stitching",
    scene: beats.length,
    sceneCount: beats.length,
  });

  const preset = resolvePodcastPreset(podcast.presetId);
  const gaps: number[] = keys.slice(0, -1).map((key, i) => {
    if (jobs[i].pauseAfterSeconds !== null) return jobs[i].pauseAfterSeconds;
    const next = keys[i + 1];
    if (key !== next) return preset.pacing.speakerChangeGapSeconds;
    return preset.pacing.sameSpeakerGapSeconds;
  });
  // Extra breath before reflective / closing turns (narrator-style interviewer lines after dialogue).
  for (let i = 0; i < gaps.length; i++) {
    const text = (beats[i + 1]?.text || "").toLowerCase();
    if (
      /never happened|learn the fastest|five minutes is enough|rarely enough/.test(
        text,
      )
    ) {
      gaps[i] = Math.max(gaps[i], 1.25);
    }
  }

  const stitched = stitchBeats(beats, DEFAULT_FPS, gaps);
  const speech = finalizeSpeechWav(stitched.wav).wav;
  const master = assemblePodcastMaster({
    speechWav: speech,
    introWav: intro?.wav,
    outroWav: outro?.wav,
    fps: DEFAULT_FPS,
  });
  const wav = master.wav;
  analyzeWav(wav);

  const timeline: PodcastBeatTiming[] = stitched.timeline.map((beat, i) => ({
    turnId: beat.sceneId,
    startFrame: beat.startFrame + master.introFrames,
    durationFrames: beat.durationFrames,
    text: beat.text,
    characterKey: keys[i],
  }));
  const chapters = derivePodcastChapters(timeline, DEFAULT_FPS);
  const finishing: PodcastFinishingSnapshot = {
    version: 1,
    intro: intro?.snapshot ?? null,
    outro: outro?.snapshot ?? null,
    pronunciations,
    pauses: jobs.flatMap((job) =>
      job.pauseAfterSeconds === null
        ? []
        : [{ turnId: job.turnId, seconds: job.pauseAfterSeconds }],
    ),
  };

  const key = `podcast-takes/${randomUUID()}.wav`;
  await getAssetStore().put(key, wav);
  let mp3Path: string | undefined;
  try {
    const mp3 = await transcodeWavToMp3(wav);
    mp3Path = `podcast-takes/${randomUUID()}.mp3`;
    await getAssetStore().put(mp3Path, mp3);
  } catch (error) {
    console.warn(
      "[podcast-takes] MP3 export unavailable; WAV remains ready:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const first = jobs[0];
  const label =
    input.label ??
    `Podcast · ${podcast.characters.length} voices · ${turnCount} turns · ${cached} reused/${generated} generated`;

  // Snapshot unique cast voices actually used (preserve character order).
  const voiceByKey = new Map<
    string,
    {
      key: string;
      name: string;
      providerId: string;
      voiceId: string;
      modelId: string | null;
    }
  >();
  for (const c of podcast.characters) {
    if (!c.providerId || !c.voiceId) continue;
    voiceByKey.set(c.key, {
      key: c.key,
      name: c.name,
      providerId: c.providerId,
      voiceId: c.voiceId,
      modelId: c.modelId ?? null,
    });
  }
  const voices = [...voiceByKey.values()];

  return createPodcastTake({
    podcastId: input.podcastId,
    label,
    providerId: first.providerId,
    voiceId: first.voiceId,
    modelId: first.modelId,
    fps: DEFAULT_FPS,
    totalFrames: stitched.totalFrames + master.introFrames + master.outroFrames,
    timeline,
    chapters,
    voices,
    audioPath: key,
    mp3Path,
    finishing,
  });
}
