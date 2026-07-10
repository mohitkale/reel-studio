/**
 * Human-facing notes for VoiceForge clone engines (license + quality/speed).
 * API `capabilities.license` remains authoritative; these blurbs help the UI.
 */

export type VoiceforgeEngineId =
  | "xtts-v2"
  | "f5-tts"
  | "openvoice-v2"
  | "rvc"
  | (string & {});

export interface VoiceforgeEngineGuide {
  id: string;
  /** Short name for dropdowns */
  shortLabel: string;
  /** One-line quality expectation */
  quality: string;
  /** Speed / hardware expectation */
  speed: string;
  /** License summary for end users */
  license: string;
  /** Commercial use allowed under typical model terms? */
  commercialOk: boolean;
  /** Prefer GPU for usable latency */
  needsGpu: boolean;
}

export const VOICEFORGE_ENGINE_GUIDES: Record<string, VoiceforgeEngineGuide> = {
  "xtts-v2": {
    id: "xtts-v2",
    shortLabel: "XTTS-v2",
    quality:
      "Strong multilingual clone similarity when it has enough RAM/VRAM — often the best “sounds like me” option among zero-shot engines.",
    speed:
      "Heavy on CPU (many minutes per scene). Much better on a GPU session. Can OOM on small Docker CPU hosts.",
    license: "CPML — non-commercial / research only (not for commercial products).",
    commercialOk: false,
    needsGpu: true,
  },
  "f5-tts": {
    id: "f5-tts",
    shortLabel: "F5-TTS",
    quality:
      "Often excellent speaker similarity and naturalness; competitive with or better than XTTS in many evals.",
    speed:
      "Also heavy on CPU — expect long waits or memory pressure without a GPU. Prefer a remote GPU for real use.",
    license: "Apache-2.0 / CC model weights — generally permissive for commercial use (verify upstream).",
    commercialOk: true,
    needsGpu: true,
  },
  "openvoice-v2": {
    id: "openvoice-v2",
    shortLabel: "OpenVoice V2",
    quality:
      "Fastest on CPU, but likeness is usually weak — good for demos/pipelines, not a close personal clone.",
    speed:
      "Lightest zero-shot option; often the only engine that finishes reliably on modest CPU Docker.",
    license: "MIT — commercial use typically allowed.",
    commercialOk: true,
    needsGpu: false,
  },
  rvc: {
    id: "rvc",
    shortLabel: "RVC",
    quality:
      "Best path to high likeness: train a short conversion model on your samples, then convert base TTS → your timbre.",
    speed:
      "Needs a training pass (GPU strongly recommended). Instant zero-shot is not the main mode.",
    license: "MIT (RVC architecture) — commercial use typically allowed; check your base TTS too.",
    commercialOk: true,
    needsGpu: true,
  },
};

export function voiceforgeEngineGuide(
  engineId: string | undefined | null,
): VoiceforgeEngineGuide | null {
  if (!engineId) return null;
  return VOICEFORGE_ENGINE_GUIDES[engineId] ?? null;
}

/** Dropdown / model label: "F5-TTS · permissive · best likeness (GPU)". */
export function voiceforgeEngineOptionLabel(
  engineId: string,
  apiLabel?: string,
): string {
  const guide = voiceforgeEngineGuide(engineId);
  if (!guide) return apiLabel || engineId;
  const licenseTag = guide.commercialOk ? "commercial OK" : "non-commercial";
  const gpuTag = guide.needsGpu ? "GPU recommended" : "CPU OK";
  return `${guide.shortLabel} · ${licenseTag} · ${gpuTag}`;
}

/** Multi-line helper under Engine / Model pickers. */
export function voiceforgeEngineHelperText(
  engineId: string,
  apiLicense?: string,
): string {
  const guide = voiceforgeEngineGuide(engineId);
  if (!guide) {
    return apiLicense
      ? `License: ${apiLicense}. Check VoiceForge docs before commercial use.`
      : "Select an engine to see license and quality notes.";
  }
  return [
    `Quality: ${guide.quality}`,
    `Speed: ${guide.speed}`,
    `License: ${apiLicense?.trim() || guide.license}`,
  ].join(" ");
}
