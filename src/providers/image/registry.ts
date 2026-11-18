import { createComfyUIProvider } from "./comfyui";
import { createOpenAICompatibleImageProvider } from "./openai-compatible";
import type { ImageProvider, ImageProviderConfig } from "./types";

/** To add an image backend: implement ImageProvider and add a case here and an id in types.ts. */
export function createImageProvider(
  config: ImageProviderConfig,
): ImageProvider {
  switch (config.providerId) {
    case "comfyui":
      return createComfyUIProvider(config);
    case "openai-compatible":
      return createOpenAICompatibleImageProvider(config);
  }
}
