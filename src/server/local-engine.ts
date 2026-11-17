/**
 * The local engine's identity on disk (roadmap M2): a per-install secret that a
 * local, user-launched MCP client presents instead of a pasted token, and a
 * lock file that says where a running engine listens. Both live in the data
 * directory (`REEL_STUDIO_HOME`, default `.data` in the project).
 */
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export interface EngineInfo {
  port: number;
  pid: number;
  startedBy: "mcp" | "user";
  startedAt: string;
}

export function engineHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.REEL_STUDIO_HOME?.trim()
    ? path.resolve(env.REEL_STUDIO_HOME)
    : path.join(process.cwd(), ".data");
}

const secretFile = (home: string) => path.join(home, "local-secret");
const infoFile = (home: string) => path.join(home, "engine.json");

/** The per-install secret; created (mode 0600) the first time it is asked for. */
export function readOrCreateLocalSecret(home = engineHome()): string {
  const file = secretFile(home);
  if (existsSync(file)) {
    const existing = readFileSync(file, "utf8").trim();
    if (existing.length >= 32) return existing;
  }
  mkdirSync(home, { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Windows has no POSIX modes; the file stays in the user's profile.
  }
  return secret;
}

/** The secret if it exists, without creating one (used by the server). */
export function peekLocalSecret(home = engineHome()): string | undefined {
  try {
    const value = readFileSync(secretFile(home), "utf8").trim();
    return value.length >= 32 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readEngineInfo(home = engineHome()): EngineInfo | null {
  try {
    const value = JSON.parse(
      readFileSync(infoFile(home), "utf8"),
    ) as Partial<EngineInfo>;
    if (
      typeof value.port === "number" &&
      Number.isInteger(value.port) &&
      typeof value.pid === "number"
    )
      return {
        port: value.port,
        pid: value.pid,
        startedBy: value.startedBy === "mcp" ? "mcp" : "user",
        startedAt: String(value.startedAt ?? ""),
      };
  } catch {
    // missing or unreadable: no engine recorded
  }
  return null;
}

export function writeEngineInfo(info: EngineInfo, home = engineHome()): void {
  mkdirSync(home, { recursive: true });
  writeFileSync(infoFile(home), `${JSON.stringify(info)}\n`);
}
