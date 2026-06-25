import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { type ProviderId, PROVIDER_IDS } from "@/providers/voice/types";
import { type AIProviderId, AI_PROVIDER_IDS } from "@/providers/ai/types";
import { type StockProviderId, STOCK_PROVIDER_IDS } from "@/providers/stock/types";

/**
 * Server-only secret management. API keys live in a git-ignored .env.local at
 * the project root. Writing also updates process.env so the key takes effect
 * immediately, without restarting the dev server.
 *
 * Do NOT import this from client components.
 */

const ENV_FILE = path.join(process.cwd(), ".env.local");

// Only server-runtime providers have an API key; client providers (webspeech,
// kokoro) run in the browser and need none, so they're absent here.
const VOICE_ENV_KEY: Partial<Record<ProviderId, string>> = {
  cartesia: "CARTESIA_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
};

const AI_ENV_KEY: Record<AIProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

const STOCK_ENV_KEY: Record<StockProviderId, string> = {
  unsplash: "UNSPLASH_ACCESS_KEY",
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
  const env = VOICE_ENV_KEY[id];
  return env ? envHas(env) : false;
}

export function keyStatus(): Record<ProviderId, boolean> {
  return Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, hasKey(id)]),
  ) as Record<ProviderId, boolean>;
}

export function setKey(id: ProviderId, value: string): Promise<void> {
  const env = VOICE_ENV_KEY[id];
  // Client providers have no key to set — no-op.
  return env ? writeEnvKey(env, value) : Promise.resolve();
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

/* Stock-image providers */

export function hasStockKey(id: StockProviderId): boolean {
  return envHas(STOCK_ENV_KEY[id]);
}

export function stockKeyStatus(): Record<StockProviderId, boolean> {
  return Object.fromEntries(
    STOCK_PROVIDER_IDS.map((id) => [id, hasStockKey(id)]),
  ) as Record<StockProviderId, boolean>;
}

export function setStockKey(id: StockProviderId, value: string): Promise<void> {
  return writeEnvKey(STOCK_ENV_KEY[id], value);
}

/* MCP server token */

const MCP_ENV_KEY = "MCP_API_TOKEN";

/** The bearer token external AI tools present to authenticate MCP-originated calls. */
export function getMcpToken(): string | undefined {
  const token = process.env[MCP_ENV_KEY]?.trim();
  return token ? token : undefined;
}

export function hasMcpToken(): boolean {
  return envHas(MCP_ENV_KEY);
}

/** Generate, persist, and return a fresh MCP token (rotating any existing one). */
export async function generateMcpToken(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await writeEnvKey(MCP_ENV_KEY, token);
  return token;
}

/** Remove the MCP token, disabling MCP-originated access until regenerated. */
export function clearMcpToken(): Promise<void> {
  return writeEnvKey(MCP_ENV_KEY, "");
}
