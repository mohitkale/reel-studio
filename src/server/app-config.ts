import { promises as fs } from "node:fs";
import path from "node:path";

import { type ProviderId } from "@/providers/voice/types";

/**
 * Non-secret app settings (default provider + default model per provider).
 * Stored as JSON in a git-ignored .data/ folder. This is intentionally tiny;
 * the M3 repository layer will absorb it into the database.
 *
 * Server-only.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(DATA_DIR, "app-config.json");

export interface AppConfig {
  defaultProviderId?: ProviderId;
  defaultModel: Partial<Record<ProviderId, string>>;
  /**
   * Whitelist of Kokoro voice ids shown in pickers (video + podcast).
   * `undefined` / omitted / empty = show all 54 voices (the default).
   */
  kokoroVisibleVoiceIds?: string[];
}

const EMPTY: AppConfig = { defaultModel: {} };

export async function getConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const config: AppConfig = { defaultModel: {}, ...parsed };
    // Normalize: empty array means "all" so users can't lock themselves out.
    if (config.kokoroVisibleVoiceIds?.length === 0) {
      delete config.kokoroVisibleVoiceIds;
    }
    return config;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
    throw e;
  }
}

async function writeConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export async function setDefaultProvider(id: ProviderId): Promise<AppConfig> {
  const config = await getConfig();
  config.defaultProviderId = id;
  await writeConfig(config);
  return config;
}

export async function setDefaultModel(
  id: ProviderId,
  modelId: string,
): Promise<AppConfig> {
  const config = await getConfig();
  config.defaultModel[id] = modelId;
  await writeConfig(config);
  return config;
}

/**
 * Set which Kokoro voices appear in pickers.
 * Pass `null` or an empty array to reset to all voices.
 */
export async function setKokoroVisibleVoices(
  voiceIds: string[] | null,
): Promise<AppConfig> {
  const config = await getConfig();
  if (!voiceIds || voiceIds.length === 0) {
    delete config.kokoroVisibleVoiceIds;
  } else {
    config.kokoroVisibleVoiceIds = [...new Set(voiceIds)];
  }
  await writeConfig(config);
  return config;
}
