import { randomUUID } from "node:crypto";

import type { PodcastTakeDTO } from "@/lib/dto";
import {
  stitchBeats,
  type BeatInput,
} from "@/lib/audio-timing";
import { normalizeWavLoudness } from "@/lib/audio-normalize";
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
import type { PodcastBeatTiming } from "@/library/podcast-schemas";

export type PodcastTakeProgress =
  | { phase: "synthesizing"; scene: number; sceneCount: number; workingOn?: number }
  | { phase: "stitching"; scene: number; sceneCount: number };

export interface GeneratePodcastTakeInput {
  podcastId: string;
  label?: string;
  onProgress?: (progress: PodcastTakeProgress) => void;
}

const DEFAULT_SYNTH_CONCURRENCY = 4;
const DEFAULT_FPS = 30;

type TurnJob = {
  index: number;
  turnId: string;
  text: string;
  characterKey: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
};

/**
 * Synthesize each turn with its character's voice (bounded concurrency),
 * then return beats in original turn order for stitching.
 */
async function synthesizeTurnsConcurrently(
  jobs: TurnJob[],
  maxConcurrency: number,
  onProgress?: (done: number, total: number, workingOn?: number) => void,
): Promise<{ beats: BeatInput[]; keys: string[] }> {
  const total = jobs.length;
  const results: BeatInput[] = new Array(total);
  const keys: string[] = new Array(total);
  let cursor = 0;
  let completed = 0;

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
      onProgress?.(completed, total, i + 1);
      const synth = getSynth(job.providerId);
      const result = await synth({
        voiceId: job.voiceId,
        modelId: job.modelId,
        text: job.text,
      });
      results[i] = {
        sceneId: job.turnId,
        text: job.text,
        wav: result.wav,
      };
      keys[i] = job.characterKey;
      completed += 1;
      onProgress?.(completed, total);
    }
  }

  const concurrency = Math.min(maxConcurrency, jobs.length || 1);
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { beats: results, keys };
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
      characterKey: c.key,
      providerId: c.providerId,
      voiceId: c.voiceId,
      modelId: c.modelId ?? undefined,
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
  input.onProgress?.({ phase: "synthesizing", scene: 0, sceneCount: turnCount });

  const { beats, keys } = await synthesizeTurnsConcurrently(
    jobs,
    maxConcurrency,
    (done, total, workingOn) =>
      input.onProgress?.({
        phase: "synthesizing",
        scene: done,
        sceneCount: total,
        workingOn,
      }),
  );

  input.onProgress?.({
    phase: "stitching",
    scene: beats.length,
    sceneCount: beats.length,
  });

  const stitched = stitchBeats(beats, DEFAULT_FPS);
  const wav = normalizeWavLoudness(stitched.wav);

  const timeline: PodcastBeatTiming[] = stitched.timeline.map((beat, i) => ({
    turnId: beat.sceneId,
    startFrame: beat.startFrame,
    durationFrames: beat.durationFrames,
    text: beat.text,
    characterKey: keys[i],
  }));

  const key = `podcast-takes/${randomUUID()}.wav`;
  await getAssetStore().put(key, wav);

  const first = jobs[0];
  const label =
    input.label ??
    `Podcast · ${podcast.characters.length} voices · ${turnCount} turns`;

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
    totalFrames: stitched.totalFrames,
    timeline,
    voices,
    audioPath: key,
  });
}
