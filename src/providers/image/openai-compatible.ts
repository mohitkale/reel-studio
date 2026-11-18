import { z } from "zod";

import { imageFetch } from "./http";
import {
  ImageProviderError,
  type GeneratedImage,
  type ImageProvider,
  type ImageProviderConfig,
} from "./types";

const imagesReply = z.object({
  data: z
    .array(
      z.object({ b64_json: z.string().optional(), url: z.string().optional() }),
    )
    .min(1),
});

/** Magic bytes, because a server may label a JPEG as PNG. */
export function sniffImage(bytes: Buffer): GeneratedImage["mime"] | undefined {
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return undefined;
}

/** Any local server that speaks POST /v1/images/generations (for example a Stable Diffusion or Flux wrapper). */
export function createOpenAICompatibleImageProvider(
  config: ImageProviderConfig,
): ImageProvider {
  return {
    id: "openai-compatible",
    label: "OpenAI-compatible image server",
    model: config.model,
    async test(signal) {
      try {
        const response = await imageFetch(config, "/v1/models", { signal });
        if (!response.ok)
          return {
            ok: false,
            message: `The server answered HTTP ${response.status} on /v1/models.`,
          };
        return { ok: true, message: "The image server answers on /v1/models." };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async generate(input): Promise<GeneratedImage> {
      const response = await imageFetch(config, "/v1/images/generations", {
        method: "POST",
        body: JSON.stringify({
          prompt: `${input.prompt}, ${input.style}`,
          n: 1,
          size: `${input.width}x${input.height}`,
          response_format: "b64_json",
          seed: input.seed,
          ...(config.model ? { model: config.model } : {}),
        }),
        signal: input.signal,
        timeoutMs: 5 * 60_000,
      });
      if (!response.ok)
        throw new ImageProviderError(
          `The image server answered HTTP ${response.status}.`,
        );
      const first = imagesReply.parse(await response.json()).data[0]!;
      let bytes: Buffer;
      if (first.b64_json) {
        bytes = Buffer.from(first.b64_json, "base64");
      } else if (first.url) {
        // Only a file on the same server is fetched; a link elsewhere is never followed.
        const base = new URL(config.baseUrl);
        const link = new URL(first.url, base);
        if (link.origin !== base.origin)
          throw new ImageProviderError(
            "The server returned a link to another site; it was not fetched.",
          );
        const file = await imageFetch(
          config,
          `${link.pathname}${link.search}`,
          {
            signal: input.signal,
            timeoutMs: 30_000,
          },
        );
        if (!file.ok)
          throw new ImageProviderError(
            `Could not fetch the image (HTTP ${file.status}).`,
          );
        bytes = Buffer.from(await file.arrayBuffer());
      } else throw new ImageProviderError("The server returned no image.");
      const mime = sniffImage(bytes);
      if (!mime)
        throw new ImageProviderError(
          "The server did not return a PNG, JPEG or WebP image.",
        );
      return { bytes, mime };
    },
  };
}
