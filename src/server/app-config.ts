import { promises as fs } from "node:fs";
import path from "node:path";

import { type ProviderId } from "@/providers/voice/types";
import { engineHome } from "@/server/local-engine";
import type { Automation } from "@/lib/automation";
import type { PronunciationRule } from "@/lib/speech-normalize";

/**
 * Non-secret app settings (default provider + default model per provider).
 * Stored as JSON in a git-ignored .data/ folder. This is intentionally tiny;
 * the M3 repository layer will absorb it into the database.
 *
 * Server-only.
 */

// `REEL_STUDIO_HOME` moves the data directory (tests and second installs use it).
const dataDir = () => engineHome();
const configFile = () => path.join(dataDir(), "app-config.json");

export interface AppConfig {
  defaultProviderId?: ProviderId;
  defaultModel: Partial<Record<ProviderId, string>>;
  /**
   * Whitelist of Kokoro voice ids shown in pickers (video + podcast).
   * `undefined` / omitted / empty = show all 54 voices (the default).
   */
  kokoroVisibleVoiceIds?: string[];
  /** Simple or Pro tools. Unset means "decide from whether the install has work in it". */
  uiMode?: "simple" | "pro";
  /** ISO time the first-run setup was finished or skipped; unset shows it once. */
  onboardedAt?: string;
  /** The user asked to run first-run setup again (Settings). Shows it even on an existing install. */
  setupRequested?: boolean;
  /** Stop for a look at the scenes before a video is made (one stop, after the storyboard is checked). */
  reviewBeforeMaking?: boolean;
  /** Steps a new video runs by itself; a missing key means on. */
  automation?: Partial<Automation>;
  /** The person's own respellings for the voice; they win over the bundled list. */
  pronunciations?: PronunciationRule[];
}

const EMPTY: AppConfig = { defaultModel: {} };

export async function getConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configFile(), "utf8");
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
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(
    configFile(),
    JSON.stringify(config, null, 2) + "\n",
    "utf8",
  );
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

export async function setUiMode(mode: "simple" | "pro"): Promise<AppConfig> {
  const config = await getConfig();
  config.uiMode = mode;
  await writeConfig(config);
  return config;
}

/** Remember that first-run setup is done so the screen shows once. `null` shows it again. */
export async function setOnboarded(done: boolean): Promise<AppConfig> {
  const config = await getConfig();
  if (done) {
    config.onboardedAt = new Date().toISOString();
    delete config.setupRequested;
  } else {
    delete config.onboardedAt;
    config.setupRequested = true;
  }
  await writeConfig(config);
  return config;
}

export async function setReviewBeforeMaking(on: boolean): Promise<AppConfig> {
  const config = await getConfig();
  if (on) config.reviewBeforeMaking = true;
  else delete config.reviewBeforeMaking;
  await writeConfig(config);
  return config;
}

export async function setAutomation(
  change: Partial<Automation>,
): Promise<AppConfig> {
  const config = await getConfig();
  config.automation = { ...config.automation, ...change };
  await writeConfig(config);
  return config;
}

export async function setPronunciations(
  rules: PronunciationRule[],
): Promise<AppConfig> {
  const config = await getConfig();
  if (rules.length === 0) delete config.pronunciations;
  else config.pronunciations = rules;
  await writeConfig(config);
  return config;
}
