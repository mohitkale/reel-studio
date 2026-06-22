import { promises as fs } from "node:fs";
import path from "node:path";

import { type ProviderId, PROVIDER_IDS } from "@/providers/voice/types";
import { type AIProviderId, AI_PROVIDER_IDS } from "@/providers/ai/types";

/**
 * Server-only secret management. API keys live in a git-ignored .env.local at
 * the project root. Writing also updates process.env so the key takes effect
 * immediately, without restarting the dev server.
 *
 * Do NOT import this from client components.
 */

const ENV_FILE = path.join(process.cwd(), ".env.local");

const VOICE_ENV_KEY: Record<ProviderId, string> = {
  cartesia: "CARTESIA_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
};

const AI_ENV_KEY: Record<AIProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

function envHas(envName: string): boolean {
  return Boolean(process.env[envName]?.trim());
}

async function readEnvFile(): Promise<string[]> {
  try {
    const raw = await fs.readFile(ENV_FILE, "utf8");
    return raw.split(/\r?\n/);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Upsert (or, with an empty value, remove) an env var in .env.local + process.env. */
async function writeEnvKey(envName: string, value: string): Promise<void> {
  const trimmed = value.trim();
  const lines = await readEnvFile();

  const keep = lines.filter(
    (line) => !line.replace(/^\s*/, "").startsWith(`${envName}=`),
  );
  if (trimmed) keep.push(`${envName}=${trimmed}`);

  while (keep.length && keep[keep.length - 1].trim() === "") keep.pop();
  const content = keep.length ? keep.join("\n") + "\n" : "";

  await fs.writeFile(ENV_FILE, content, { encoding: "utf8", mode: 0o600 });

  if (trimmed) process.env[envName] = trimmed;
  else delete process.env[envName];
}

/* Voice providers */

export function hasKey(id: ProviderId): boolean {
  return envHas(VOICE_ENV_KEY[id]);
}

export function keyStatus(): Record<ProviderId, boolean> {
  return Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, hasKey(id)]),
  ) as Record<ProviderId, boolean>;
}

export function setKey(id: ProviderId, value: string): Promise<void> {
  return writeEnvKey(VOICE_ENV_KEY[id], value);
}

/* AI providers */

export function hasAIKey(id: AIProviderId): boolean {
  return envHas(AI_ENV_KEY[id]);
}

export function aiKeyStatus(): Record<AIProviderId, boolean> {
  return Object.fromEntries(
    AI_PROVIDER_IDS.map((id) => [id, hasAIKey(id)]),
  ) as Record<AIProviderId, boolean>;
}

export function setAIKey(id: AIProviderId, value: string): Promise<void> {
  return writeEnvKey(AI_ENV_KEY[id], value);
}
