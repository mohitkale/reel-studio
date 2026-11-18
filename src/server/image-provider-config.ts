import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { engineHome } from "@/server/local-engine";
import {
  IMAGE_PROVIDER_IDS,
  type ImageProviderConfig,
} from "@/providers/image/types";
import { validateLocalAIEndpoint } from "@/providers/ai/local-endpoint";

export const imageProviderInputSchema = z
  .object({
    providerId: z.enum(IMAGE_PROVIDER_IDS),
    baseUrl: z.string().trim().min(1).max(2048),
    model: z.string().trim().max(256).default(""),
    allowLan: z.boolean().default(false),
  })
  .strict();

const fileSchema = z
  .object({
    version: z.literal(1),
    config: imageProviderInputSchema.nullable(),
  })
  .strict();

export const IMAGE_PROVIDER_DEFAULT_URLS = {
  comfyui: "http://127.0.0.1:8188",
  "openai-compatible": "http://127.0.0.1:7860",
} as const;

/** Image generation is off until the person sets it up here. */
export function createImageProviderConfigStore(
  filePath = path.join(engineHome(), "image-provider.json"),
) {
  async function read(): Promise<ImageProviderConfig | null> {
    try {
      return fileSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")))
        .config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async function write(config: ImageProviderConfig | null) {
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify({ version: 1, config }, null, 2)}\n`,
      {
        mode: 0o600,
      },
    );
    await fs.rename(temporary, filePath);
  }
  return {
    read,
    async save(input: z.input<typeof imageProviderInputSchema>) {
      const parsed = imageProviderInputSchema.parse(input);
      const endpoint = await validateLocalAIEndpoint(
        parsed.baseUrl,
        parsed.allowLan,
      );
      const config = { ...parsed, baseUrl: endpoint.baseUrl };
      await write(config);
      return config;
    },
    async clear() {
      await write(null);
    },
  };
}

export const imageProviderConfigStore = createImageProviderConfigStore();
