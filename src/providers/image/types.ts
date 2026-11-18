/**
 * Optional image generation (roadmap P3). A scene's `media.generate` prompt is
 * turned into a picture by a model running on this computer. Off by default;
 * with nothing configured a scene uses a stock picture or the themed background.
 * This is the one place a second model is involved, and it never leaves the
 * machine unless the person points it at a server on their own network.
 */
export type ImageProviderId = "comfyui" | "openai-compatible";
export const IMAGE_PROVIDER_IDS = ["comfyui", "openai-compatible"] as const;

export interface GenerateImageInput {
  prompt: string;
  /** Pixel size, multiples of 64. */
  width: number;
  height: number;
  /** Style words added after the prompt so the picture matches the look. */
  style: string;
  /** Derived from the video seed, so the same video gets the same picture. */
  seed: number;
  signal?: AbortSignal;
}

export interface GeneratedImage {
  bytes: Buffer;
  mime: "image/png" | "image/jpeg" | "image/webp";
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string;
  /** What names the model in the cache key: checkpoint or model id. */
  model: string;
  generate(input: GenerateImageInput): Promise<GeneratedImage>;
  /** A cheap check that the server answers and the model exists. */
  test(signal?: AbortSignal): Promise<{ ok: boolean; message: string }>;
}

export class ImageProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ImageProviderError";
  }
}

export interface ImageProviderConfig {
  providerId: ImageProviderId;
  baseUrl: string;
  /** ComfyUI checkpoint file name, or the model id an OpenAI-compatible server expects. */
  model: string;
  allowLan: boolean;
}
