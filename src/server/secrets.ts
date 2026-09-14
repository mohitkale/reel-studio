import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { type ProviderId, PROVIDER_IDS } from "@/providers/voice/types";
import { type AIProviderId, AI_PROVIDER_IDS } from "@/providers/ai/types";
import {
  type StockProviderId,
  STOCK_PROVIDER_IDS,
} from "@/providers/stock/types";
import {
  type MusicProviderId,
  MUSIC_PROVIDER_IDS,
} from "@/providers/music/types";
import {
  createMcpTokenSchema,
  mcpNamedTokenRecordSchema,
  type McpNamedTokenRecord,
} from "@/production/mcp-access";

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
  pexels: "PEXELS_API_KEY",
};

const MUSIC_ENV_KEY: Record<MusicProviderId, string> = {
  jamendo: "JAMENDO_CLIENT_ID",
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

/* Stock-media providers */

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

/* Music providers */

export function hasMusicKey(id: MusicProviderId): boolean {
  return envHas(MUSIC_ENV_KEY[id]);
}

export function musicKeyStatus(): Record<MusicProviderId, boolean> {
  return Object.fromEntries(
    MUSIC_PROVIDER_IDS.map((id) => [id, hasMusicKey(id)]),
  ) as Record<MusicProviderId, boolean>;
}

export function setMusicKey(id: MusicProviderId, value: string): Promise<void> {
  return writeEnvKey(MUSIC_ENV_KEY[id], value);
}

/* MCP server token */

const MCP_ENV_KEY = "MCP_API_TOKEN";
const MCP_NAMED_ENV_KEY = "MCP_NAMED_TOKENS";

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

function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function namedMcpTokens(): McpNamedTokenRecord[] {
  const raw = process.env[MCP_NAMED_ENV_KEY]?.trim();
  if (!raw) return [];
  try {
    return mcpNamedTokenRecordSchema.array().parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveNamedMcpTokens(records: McpNamedTokenRecord[]): Promise<void> {
  return writeEnvKey(MCP_NAMED_ENV_KEY, JSON.stringify(records));
}

export function listNamedMcpTokens(): Omit<McpNamedTokenRecord, "tokenHash">[] {
  return namedMcpTokens().map((record) => ({
    id: record.id,
    name: record.name,
    scopes: record.scopes,
    allowedProviders: record.allowedProviders,
    paidProviders: record.paidProviders,
    maxDurationSeconds: record.maxDurationSeconds,
    maxBatchSize: record.maxBatchSize,
    paidRequestLimit: record.paidRequestLimit,
    paidRequestsUsed: record.paidRequestsUsed,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  }));
}

export function findNamedMcpToken(
  token: string,
): McpNamedTokenRecord | undefined {
  const hash = hashMcpToken(token);
  return namedMcpTokens().find((record) => record.tokenHash === hash);
}

/** Create a named, least-privilege MCP token. The raw token is returned once. */
export async function generateNamedMcpToken(input: unknown) {
  const parsed = createMcpTokenSchema.parse(input);
  const id = randomUUID();
  const token = `rs_mcp_${id}.${randomBytes(32).toString("base64url")}`;
  const record: McpNamedTokenRecord = {
    id,
    name: parsed.name,
    tokenHash: hashMcpToken(token),
    ...parsed.policy,
    paidRequestsUsed: 0,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await saveNamedMcpTokens([...namedMcpTokens(), record]);
  return {
    token,
    record: listNamedMcpTokens().find((item) => item.id === id)!,
  };
}

export async function revokeNamedMcpToken(id: string): Promise<boolean> {
  const records = namedMcpTokens();
  const next = records.filter((record) => record.id !== id);
  if (next.length === records.length) return false;
  await saveNamedMcpTokens(next);
  return true;
}

let namedTokenWrite = Promise.resolve();

/** Reserve one unknown-price paid provider request before it starts. */
export async function reserveNamedMcpPaidRequest(id: string): Promise<boolean> {
  let reserved = false;
  namedTokenWrite = namedTokenWrite.then(async () => {
    const records = namedMcpTokens();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return;
    const record = records[index];
    if (record.paidRequestsUsed >= record.paidRequestLimit) return;
    records[index] = {
      ...record,
      paidRequestsUsed: record.paidRequestsUsed + 1,
      lastUsedAt: new Date().toISOString(),
    };
    await saveNamedMcpTokens(records);
    reserved = true;
  });
  await namedTokenWrite;
  return reserved;
}
