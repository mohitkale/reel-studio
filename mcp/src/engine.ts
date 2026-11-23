/**
 * Finds the local studio engine, or starts it headless (roadmap M2), so adding
 * the MCP server to a client is the only setup. A lock file in the data
 * directory names the running engine's port; a per-install secret in the same
 * directory authenticates the local client. Two clients at once share one
 * engine: the second waits for the first's start-up instead of starting its own.
 */
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  rmSync,
  statSync,
} from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

import {
  engineHome,
  readEngineInfo,
  readOrCreateLocalSecret,
  writeEngineInfo,
  type EngineInfo,
} from "../../src/server/local-engine";
import { isInstalledStudio } from "../../scripts/installed-environment.mjs";

export interface Engine {
  baseUrl: string;
  secret: string;
}

const root = path.resolve(import.meta.dirname, "..", "..");
const START_TIMEOUT_MS = 240_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when an engine answers on this port and accepts the secret. */
export async function engineHealthy(
  port: number,
  secret: string,
): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/production-presets`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No free port")),
      );
    });
  });
}

/** Take the start-up lock; null when another process holds a fresh one. */
function takeLock(lockPath: string): number | null {
  try {
    return openSync(lockPath, "wx");
  } catch {
    try {
      if (Date.now() - statSync(lockPath).mtimeMs > START_TIMEOUT_MS) {
        rmSync(lockPath, { force: true });
        return openSync(lockPath, "wx");
      }
    } catch {
      // raced with another client; treat as held
    }
    return null;
  }
}

export async function ensureEngine(
  log: (line: string) => void,
  startedBy: EngineInfo["startedBy"] = "mcp",
): Promise<Engine> {
  const home = engineHome();
  mkdirSync(home, { recursive: true });
  const secret = readOrCreateLocalSecret(home);
  const deadline = Date.now() + START_TIMEOUT_MS;

  for (;;) {
    const info = readEngineInfo(home);
    if (info && (await engineHealthy(info.port, secret))) {
      log(`using the studio engine on port ${info.port}`);
      return { baseUrl: `http://127.0.0.1:${info.port}`, secret };
    }
    if (Date.now() > deadline)
      throw new Error(
        `The studio engine did not become ready in time. See ${path.join(home, "engine.log")}.`,
      );

    const lockPath = path.join(home, "engine.lock");
    const lock = takeLock(lockPath);
    if (lock === null) {
      // Another client is starting the engine; wait for it.
      await sleep(1000);
      continue;
    }
    try {
      const port = await freePort();
      const mode =
        isInstalledStudio(root) ||
        existsSync(path.join(root, ".next", "BUILD_ID"))
          ? "start"
          : "dev";
      const out = openSync(path.join(home, "engine.log"), "a");
      log(`starting the studio engine (${mode}) on port ${port}`);
      const child = spawn(
        process.execPath,
        [path.join(root, "scripts", "supervise.mjs"), mode, "-p", String(port)],
        {
          cwd: root,
          detached: true,
          stdio: ["ignore", out, out],
          env: {
            ...process.env,
            PORT: String(port),
            REEL_STUDIO_HOME: home,
            REEL_ENGINE_STARTED_BY: startedBy,
          },
        },
      );
      child.unref();
      closeSync(out);
      writeEngineInfo(
        {
          port,
          pid: child.pid ?? 0,
          startedBy,
          startedAt: new Date().toISOString(),
        },
        home,
      );
      while (Date.now() < deadline) {
        if (await engineHealthy(port, secret)) {
          log("the studio engine is ready");
          return { baseUrl: `http://127.0.0.1:${port}`, secret };
        }
        await sleep(1500);
      }
    } finally {
      closeSync(lock);
      rmSync(lockPath, { force: true });
    }
  }
}
