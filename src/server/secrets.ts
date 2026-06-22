import { promises as fs } from "node:fs";
import path from "node:path";

import { type ProviderId, PROVIDER_IDS } from "@/providers/voice/types";

/**
 * Server-only secret management. Provider API keys live in a git-ignored
 * .env.local at the project root. Writing also updates process.env so the key
 * takes effect immediately, without restarting the dev server.
 *
 * Do NOT import this from client components.
 */

const ENV_FILE = path.join(process.cwd(), ".env.local");

const ENV_KEY: Record<ProviderId, string> = {
  cartesia: "CARTESIA_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
};

export function hasKey(id: ProviderId): boolean {
  return Boolean(process.env[ENV_KEY[id]]?.trim());
}

export function keyStatus(): Record<ProviderId, boolean> {
  return Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, hasKey(id)]),
  ) as Record<ProviderId, boolean>;
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

/** Upsert (or, with an empty value, remove) a provider key in .env.local + process.env. */
export async function setKey(id: ProviderId, value: string): Promise<void> {
  const envName = ENV_KEY[id];
  const trimmed = value.trim();
  const lines = await readEnvFile();

  const keep = lines.filter(
    (line) => !line.replace(/^\s*/, "").startsWith(`${envName}=`),
  );
  if (trimmed) keep.push(`${envName}=${trimmed}`);

  // Drop trailing blank lines, then end with a single newline.
  while (keep.length && keep[keep.length - 1].trim() === "") keep.pop();
  const content = keep.length ? keep.join("\n") + "\n" : "";

  await fs.writeFile(ENV_FILE, content, { encoding: "utf8", mode: 0o600 });

  if (trimmed) process.env[envName] = trimmed;
  else delete process.env[envName];
}
