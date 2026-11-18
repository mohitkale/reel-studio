import { z } from "zod";

import { imageFetch } from "./http";
import {
  ImageProviderError,
  type GenerateImageInput,
  type GeneratedImage,
  type ImageProvider,
  type ImageProviderConfig,
} from "./types";

const NEGATIVE =
  "text, watermark, logo, signature, caption, blurry, low quality, deformed, extra fingers";

const promptReply = z.object({ prompt_id: z.string().min(1) });
const historyReply = z.record(
  z.string(),
  z.object({
    outputs: z
      .record(
        z.string(),
        z.object({
          images: z
            .array(
              z.object({
                filename: z.string(),
                subfolder: z.string().default(""),
                type: z.string().default("output"),
              }),
            )
            .optional(),
        }),
      )
      .default({}),
  }),
);
const checkpointsReply = z.object({
  CheckpointLoaderSimple: z.object({
    input: z.object({
      required: z.object({
        ckpt_name: z.tuple([z.array(z.string())]).rest(z.unknown()),
      }),
    }),
  }),
});

/** A plain text-to-image graph in ComfyUI's API format. */
export function comfyWorkflow(input: GenerateImageInput, checkpoint: string) {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: input.seed,
        steps: 20,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width: input.width, height: input.height, batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: `${input.prompt}, ${input.style}`, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: NEGATIVE, clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "reel", images: ["8", 0] },
    },
  };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new ImageProviderError("The image request was cancelled.", 499));
    });
  });

/** A local ComfyUI server (default http://127.0.0.1:8188). */
export function createComfyUIProvider(
  config: ImageProviderConfig,
  options: { pollMs?: number; maxWaitMs?: number } = {},
): ImageProvider {
  const pollMs = options.pollMs ?? 1000;
  const maxWaitMs = options.maxWaitMs ?? 5 * 60_000;

  async function checkpoints(signal?: AbortSignal): Promise<string[]> {
    const response = await imageFetch(
      config,
      "/object_info/CheckpointLoaderSimple",
      { signal },
    );
    if (!response.ok)
      throw new ImageProviderError(`ComfyUI answered HTTP ${response.status}.`);
    return checkpointsReply.parse(await response.json()).CheckpointLoaderSimple
      .input.required.ckpt_name[0];
  }

  return {
    id: "comfyui",
    label: "ComfyUI",
    model: config.model,
    async test(signal) {
      try {
        const names = await checkpoints(signal);
        if (names.length === 0)
          return {
            ok: false,
            message:
              "ComfyUI is running but has no checkpoint models installed.",
          };
        if (config.model && !names.includes(config.model))
          return {
            ok: false,
            message: `ComfyUI does not have “${config.model}”. Installed: ${names.slice(0, 5).join(", ")}.`,
          };
        return {
          ok: true,
          message: `ComfyUI is running with ${names.length} model${names.length === 1 ? "" : "s"}. Using ${config.model || names[0]}.`,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async generate(input): Promise<GeneratedImage> {
      const checkpoint = config.model || (await checkpoints(input.signal))[0];
      if (!checkpoint)
        throw new ImageProviderError("ComfyUI has no checkpoint model to use.");
      const queued = await imageFetch(config, "/prompt", {
        method: "POST",
        body: JSON.stringify({
          prompt: comfyWorkflow(input, checkpoint),
          client_id: "reel-studio",
        }),
        signal: input.signal,
      });
      if (!queued.ok)
        throw new ImageProviderError(
          `ComfyUI refused the job (HTTP ${queued.status}).`,
        );
      const { prompt_id } = promptReply.parse(await queued.json());
      const started = Date.now();
      for (;;) {
        await sleep(pollMs, input.signal);
        const history = await imageFetch(
          config,
          `/history/${encodeURIComponent(prompt_id)}`,
          {
            signal: input.signal,
          },
        );
        if (history.ok) {
          const entry = historyReply.parse(await history.json())[prompt_id];
          const image = entry
            ? Object.values(entry.outputs).flatMap(
                (output) => output.images ?? [],
              )[0]
            : undefined;
          if (image) {
            const query = new URLSearchParams({
              filename: image.filename,
              subfolder: image.subfolder,
              type: image.type,
            });
            const file = await imageFetch(config, `/view?${query}`, {
              signal: input.signal,
              timeoutMs: 30_000,
            });
            if (!file.ok)
              throw new ImageProviderError(
                `ComfyUI could not return the image (HTTP ${file.status}).`,
              );
            return {
              bytes: Buffer.from(await file.arrayBuffer()),
              mime: "image/png",
            };
          }
        }
        if (Date.now() - started > maxWaitMs)
          throw new ImageProviderError(
            "ComfyUI took too long to make the picture.",
            504,
          );
      }
    },
  };
}
