import { randomUUID } from "node:crypto";

import type { SceneVoiceClipDTO, VoiceTakeDTO } from "@/lib/dto";
import {
  estimateSpeechSeconds,
  framesFromSeconds,
  stitchBeats,
  type BeatInput,
} from "@/lib/audio-timing";
import { normalizeWavLoudness } from "@/lib/audio-normalize";
import { makeSilentWav, parseWav } from "@/lib/wav";
import { getProvider } from "@/providers/voice/registry";
import {
  ProviderError,
  type ProviderId,
} from "@/providers/voice/types";
import { prisma } from "@/library/db";
import {
  getCachedBeatWav,
  hashSpokenText,
  setCachedBeatWav,
} from "@/library/scene-audio-cache";
import { getAssetStore } from "@/library/storage";
import {
  createSceneClip,
  selectSceneClip,
} from "@/library/repositories/scene-clips";
import { createTake } from "@/library/repositories/takes";
import {
  hasSpokenContent,
  resolveSpokenText,
} from "@/lib/spoken-text";

const DEFAULT_SYNTH_CONCURRENCY = 4;

/** @deprecated Use hasSpokenContent / resolveSpokenText from @/lib/spoken-text */
export function hasSpokenText(text: string): boolean {
  return text.trim().length > 0;
}

export type SceneClipProgress =
  | { phase: "synthesizing"; scene: number; sceneCount: number; workingOn?: number }
  | { phase: "stitching"; scene: number; sceneCount: number };

export interface GenerateSceneClipInput {
  sceneId: string;
  placeholder?: boolean;
  providerId?: ProviderId;
  voiceId?: string;
  modelId?: string;
  label?: string;
  /** When true (default), select this clip on the scene after create. */
  select?: boolean;
  /** When true (default), assemble a VoiceTake after selection when all scenes ready. */
  assemble?: boolean;
}

export interface GenerateAllSceneClipsInput {
  scriptId: string;
  placeholder?: boolean;
  providerId?: ProviderId;
  voiceId?: string;
  modelId?: string;
  label?: string;
  onProgress?: (progress: SceneClipProgress) => void;
  /** When true (default), assemble after all clips are selected. */
  assemble?: boolean;
}

export interface AssembleResult {
  take: VoiceTakeDTO | null;
  clips: SceneVoiceClipDTO[];
}

function durationFramesFromWav(wav: Buffer, fps: number): number {
  const info = parseWav(wav);
  return framesFromSeconds(info.durationSeconds, fps);
}

async function persistClipFromWav(opts: {
  scriptId: string;
  sceneId: string;
  text: string;
  wav: Buffer;
  fps: number;
  providerId: string;
  voiceId: string;
  modelId?: string;
  label?: string;
  isPlaceholder?: boolean;
  select?: boolean;
}): Promise<SceneVoiceClipDTO> {
  const key = `scene-clips/${opts.sceneId}-${randomUUID()}.wav`;
  await getAssetStore().put(key, opts.wav);
  const clip = await createSceneClip({
    scriptId: opts.scriptId,
    sceneId: opts.sceneId,
    providerId: opts.providerId,
    voiceId: opts.voiceId,
    modelId: opts.modelId,
    text: opts.text,
    textHash: hashSpokenText(opts.text),
    audioPath: key,
    durationFrames: durationFramesFromWav(opts.wav, opts.fps),
    fps: opts.fps,
    label: opts.label,
    isPlaceholder: opts.isPlaceholder,
  });
  if (opts.select !== false) {
    await selectSceneClip(opts.sceneId, clip.id);
  }
  return clip;
}

/**
 * Synthesize (or placeholder) one scene's voice clip and optionally select it.
 */
export async function generateSceneClip(
  input: GenerateSceneClipInput,
): Promise<{ clip: SceneVoiceClipDTO; take: VoiceTakeDTO | null }> {
  const scene = await prisma.scene.findUnique({
    where: { id: input.sceneId },
    include: { script: true },
  });
  if (!scene) throw new ProviderError("Scene not found", 404);

  const fps = scene.script.fps;
  let wav: Buffer;
  let providerId: string;
  let voiceId: string;
  let label = input.label;
  let isPlaceholder = Boolean(input.placeholder);

  const spoken = resolveSpokenText(scene);

  // Blank spoken text → short silent hold (never call TTS with "").
  if (!hasSpokenContent(scene) || input.placeholder) {
    wav = makeSilentWav(estimateSpeechSeconds(spoken));
    providerId = "placeholder";
    voiceId = "silent";
    isPlaceholder = true;
    label =
      label ??
      (hasSpokenContent(scene)
        ? "Placeholder (silent)"
        : "Silent (no spoken text)");
  } else {
    if (!input.providerId || !input.voiceId) {
      throw new ProviderError("Pick a provider and voice first", 400);
    }
    const provider = getProvider(input.providerId);
    if (provider.runtime === "client" || !provider.synth) {
      throw new ProviderError(
        `${provider.label} runs in your browser. Use "Generate in browser" in the editor instead.`,
        400,
        input.providerId,
      );
    }
    if (!provider.isConfigured()) {
      throw new ProviderError(
        input.providerId === "voiceforge"
          ? `${provider.label} is not configured. Set VOICEFORGE_SERVICE_URL in .env.local.`
          : `${provider.label} has no API key. Add one in Settings.`,
        400,
        input.providerId,
      );
    }

    const cacheParts = {
      sceneId: scene.id,
      providerId: input.providerId,
      voiceId: input.voiceId,
      modelId: input.modelId,
      text: spoken,
    };
    let cached = await getCachedBeatWav(cacheParts);
    if (!cached) {
      const result = await provider.synth({
        voiceId: input.voiceId,
        modelId: input.modelId,
        text: spoken,
      });
      cached = result.wav;
      void setCachedBeatWav(
        { ...cacheParts, scriptId: scene.scriptId },
        cached,
      );
    }
    wav = cached;
    providerId = input.providerId;
    voiceId = input.voiceId;
    label = label ?? `${provider.label}${input.modelId ? ` · ${input.modelId}` : ""}`;
  }

  const clip = await persistClipFromWav({
    scriptId: scene.scriptId,
    sceneId: scene.id,
    text: spoken,
    wav,
    fps,
    providerId,
    voiceId,
    modelId: input.modelId,
    label,
    isPlaceholder,
    select: input.select,
  });

  let take: VoiceTakeDTO | null = null;
  if (input.assemble !== false) {
    try {
      take = await assembleVoiceTake(scene.scriptId);
    } catch {
      // Not all scenes ready yet — clip is still saved/selected.
      take = null;
    }
  }

  return { clip, take };
}

/**
 * Generate a new clip for every scene in parallel, select each newest clip,
 * then assemble a VoiceTake when possible.
 */
export async function generateAllSceneClips(
  input: GenerateAllSceneClipsInput,
): Promise<AssembleResult> {
  const script = await prisma.script.findUnique({
    where: { id: input.scriptId },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!script) throw new ProviderError("Script not found", 404);
  if (script.scenes.length === 0) {
    throw new ProviderError("Add at least one scene before generating clips", 400);
  }

  const sceneCount = script.scenes.length;
  input.onProgress?.({ phase: "synthesizing", scene: 0, sceneCount });

  const clips: SceneVoiceClipDTO[] = new Array(sceneCount);
  let cursor = 0;
  let completed = 0;

  let providerLabel = "Placeholder";
  let maxConcurrency = 1;

  if (!input.placeholder) {
    if (!input.providerId || !input.voiceId) {
      throw new ProviderError("Pick a provider and voice first", 400);
    }
    const provider = getProvider(input.providerId);
    if (provider.runtime === "client" || !provider.synth) {
      throw new ProviderError(
        `${provider.label} runs in your browser. Use "Generate in browser" in the editor instead.`,
        400,
        input.providerId,
      );
    }
    if (!provider.isConfigured()) {
      throw new ProviderError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        input.providerId,
      );
    }
    providerLabel = provider.label;
    maxConcurrency = provider.maxConcurrency ?? DEFAULT_SYNTH_CONCURRENCY;
  }

  async function synthOne(
    scene: { id: string; text: string; spokenText: string | null },
    index: number,
  ): Promise<SceneVoiceClipDTO> {
    let wav: Buffer;
    let providerId: string;
    let voiceId: string;
    let isPlaceholder = Boolean(input.placeholder);
    let clipLabel: string;
    const spoken = resolveSpokenText(scene);

    if (input.placeholder || !hasSpokenContent(scene)) {
      wav = makeSilentWav(estimateSpeechSeconds(spoken));
      providerId = "placeholder";
      voiceId = "silent";
      isPlaceholder = true;
      clipLabel =
        input.label ??
        (hasSpokenContent(scene)
          ? "Placeholder (silent)"
          : "Silent (no spoken text)");
    } else {
      const cacheParts = {
        sceneId: scene.id,
        providerId: input.providerId!,
        voiceId: input.voiceId!,
        modelId: input.modelId,
        text: spoken,
      };
      let cached = await getCachedBeatWav(cacheParts);
      if (!cached) {
        input.onProgress?.({
          phase: "synthesizing",
          scene: completed,
          sceneCount,
          workingOn: index + 1,
        });
        const provider = getProvider(input.providerId!);
        const result = await provider.synth!({
          voiceId: input.voiceId!,
          modelId: input.modelId,
          text: spoken,
        });
        cached = result.wav;
        void setCachedBeatWav(
          { ...cacheParts, scriptId: input.scriptId },
          cached,
        );
      }
      wav = cached;
      providerId = input.providerId!;
      voiceId = input.voiceId!;
      clipLabel =
        input.label ??
        `${providerLabel}${input.modelId ? ` · ${input.modelId}` : ""}`;
    }

    return persistClipFromWav({
      scriptId: input.scriptId,
      sceneId: scene.id,
      text: spoken,
      wav,
      fps: script!.fps,
      providerId,
      voiceId,
      modelId: input.modelId,
      label: clipLabel,
      isPlaceholder,
      select: true,
    });
  }

  async function worker() {
    while (cursor < script!.scenes.length) {
      const i = cursor++;
      const scene = script!.scenes[i];
      clips[i] = await synthOne(scene, i);
      completed += 1;
      input.onProgress?.({
        phase: "synthesizing",
        scene: completed,
        sceneCount,
      });
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(maxConcurrency, sceneCount || 1) },
      () => worker(),
    ),
  );

  input.onProgress?.({
    phase: "stitching",
    scene: sceneCount,
    sceneCount,
  });

  if (input.assemble === false) {
    return { take: null, clips };
  }

  const take = await assembleVoiceTake(input.scriptId);
  return { take, clips };
}

/**
 * Stitch currently selected scene clips into a VoiceTake (source: assembled).
 * Requires every scene to have a selected clip whose textHash matches current text.
 */
export async function assembleVoiceTake(
  scriptId: string,
): Promise<VoiceTakeDTO> {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: { selectedVoiceClip: true },
      },
    },
  });
  if (!script) throw new ProviderError("Script not found", 404);
  if (script.scenes.length === 0) {
    throw new ProviderError("Add at least one scene before assembling audio", 400);
  }

  const missing: number[] = [];
  const stale: number[] = [];
  const beats: BeatInput[] = [];
  let providerId = "assembled";
  let voiceId = "mixed";
  let modelId: string | undefined;
  let isPlaceholder = true;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const clip = scene.selectedVoiceClip;
    if (!clip) {
      missing.push(i + 1);
      continue;
    }
    const spoken = resolveSpokenText(scene);
    const currentHash = hashSpokenText(spoken);
    if (clip.textHash !== currentHash) {
      stale.push(i + 1);
      continue;
    }
    const wav = await getAssetStore().get(clip.audioPath);
    beats.push({ sceneId: scene.id, text: spoken, wav });
    if (i === 0) {
      providerId = clip.providerId;
      voiceId = clip.voiceId;
      modelId = clip.modelId ?? undefined;
    }
    if (!clip.isPlaceholder) isPlaceholder = false;
  }

  if (missing.length || stale.length) {
    const parts: string[] = [];
    if (missing.length) {
      parts.push(
        `missing audio for scene${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`,
      );
    }
    if (stale.length) {
      parts.push(
        `stale audio (text changed) for scene${stale.length > 1 ? "s" : ""} ${stale.join(", ")}`,
      );
    }
    throw new ProviderError(
      `Cannot assemble voiceover: ${parts.join("; ")}. Generate or re-select clips first.`,
      400,
    );
  }

  const stitched = stitchBeats(beats, script.fps);
  const wav = isPlaceholder
    ? stitched.wav
    : normalizeWavLoudness(stitched.wav);
  const key = `takes/${randomUUID()}.wav`;
  await getAssetStore().put(key, wav);

  return createTake({
    scriptId,
    label: "Assembled from scenes",
    providerId,
    voiceId,
    modelId,
    fps: script.fps,
    totalFrames: stitched.totalFrames,
    timeline: stitched.timeline,
    audioPath: key,
    isPlaceholder,
    source: "assembled",
  });
}

export interface UploadedSceneClip {
  sceneId: string;
  wav: Buffer;
}

/**
 * Persist a client-generated (e.g. Kokoro) WAV as a SceneVoiceClip and select it.
 */
export async function createSceneClipFromUpload(input: {
  scriptId: string;
  sceneId: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  label?: string;
  wav: Buffer;
  select?: boolean;
  assemble?: boolean;
}): Promise<{ clip: SceneVoiceClipDTO; take: VoiceTakeDTO | null }> {
  const scene = await prisma.scene.findUnique({
    where: { id: input.sceneId },
    include: { script: true },
  });
  if (!scene) throw new ProviderError("Scene not found", 404);
  if (scene.scriptId !== input.scriptId) {
    throw new ProviderError("Scene does not belong to this script", 400);
  }

  const spoken = resolveSpokenText(scene);

  // Blank spoken text → ignore uploaded TTS and store a silent hold.
  if (!hasSpokenContent(scene)) {
    const silent = makeSilentWav(estimateSpeechSeconds(spoken));
    const clip = await persistClipFromWav({
      scriptId: input.scriptId,
      sceneId: input.sceneId,
      text: spoken,
      wav: silent,
      fps: scene.script.fps,
      providerId: "placeholder",
      voiceId: "silent",
      modelId: input.modelId,
      label: "Silent (no spoken text)",
      isPlaceholder: true,
      select: input.select,
    });
    let take: VoiceTakeDTO | null = null;
    if (input.assemble !== false) {
      try {
        take = await assembleVoiceTake(input.scriptId);
      } catch {
        take = null;
      }
    }
    return { clip, take };
  }

  parseWav(input.wav);

  const clip = await persistClipFromWav({
    scriptId: input.scriptId,
    sceneId: input.sceneId,
    text: spoken,
    wav: input.wav,
    fps: scene.script.fps,
    providerId: input.providerId,
    voiceId: input.voiceId,
    modelId: input.modelId,
    label: input.label ?? input.providerId,
    isPlaceholder: false,
    select: input.select,
  });

  // Also warm the oneshot TTS cache so regenerating a full take can skip this scene.
  void setCachedBeatWav(
    {
      scriptId: input.scriptId,
      sceneId: input.sceneId,
      providerId: input.providerId,
      voiceId: input.voiceId,
      modelId: input.modelId,
      text: spoken,
    },
    input.wav,
  );

  let take: VoiceTakeDTO | null = null;
  if (input.assemble !== false) {
    try {
      take = await assembleVoiceTake(input.scriptId);
    } catch {
      take = null;
    }
  }

  return { clip, take };
}

/**
 * Upload clips for every scene (client TTS), select each, assemble.
 */
export async function createAllSceneClipsFromUpload(input: {
  scriptId: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  label?: string;
  beats: UploadedSceneClip[];
}): Promise<AssembleResult> {
  const script = await prisma.script.findUnique({
    where: { id: input.scriptId },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!script) throw new ProviderError("Script not found", 404);
  if (script.scenes.length === 0) {
    throw new ProviderError("Add at least one scene before uploading clips", 400);
  }

  const byScene = new Map(input.beats.map((b) => [b.sceneId, b.wav]));
  const clips: SceneVoiceClipDTO[] = [];

  for (const scene of script.scenes) {
    let wav = byScene.get(scene.id);
    let providerId = input.providerId;
    let voiceId = input.voiceId;
    let isPlaceholder = false;
    let label = input.label ?? input.providerId;
    const spoken = resolveSpokenText(scene);

    if (!hasSpokenContent(scene)) {
      wav = makeSilentWav(estimateSpeechSeconds(spoken));
      providerId = "placeholder";
      voiceId = "silent";
      isPlaceholder = true;
      label = "Silent (no spoken text)";
    } else if (!wav) {
      throw new ProviderError(
        "Audio is missing for one or more scenes — regenerate the voiceover.",
        400,
      );
    } else {
      parseWav(wav);
    }

    const clip = await persistClipFromWav({
      scriptId: input.scriptId,
      sceneId: scene.id,
      text: spoken,
      wav: wav!,
      fps: script.fps,
      providerId,
      voiceId,
      modelId: input.modelId,
      label,
      isPlaceholder,
      select: true,
    });
    if (!isPlaceholder) {
      void setCachedBeatWav(
        {
          scriptId: input.scriptId,
          sceneId: scene.id,
          providerId: input.providerId,
          voiceId: input.voiceId,
          modelId: input.modelId,
          text: spoken,
        },
        wav!,
      );
    }
    clips.push(clip);
  }

  const take = await assembleVoiceTake(input.scriptId);
  return { take, clips };
}

/** Whether a selected clip still matches the scene's current spoken text. */
export function isClipFreshForText(
  clipTextHash: string,
  sceneText: string,
): boolean {
  return clipTextHash === hashSpokenText(sceneText);
}
