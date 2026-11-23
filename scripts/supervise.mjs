import { spawn } from "node:child_process";
import { stopProcessTree } from "./process-tree.mjs";
import { pathToFileURL } from "node:url";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { isInstalledStudio } from "./installed-environment.mjs";
import { main as migrateDatabase } from "./migrate-database.mjs";

/**
 * A FFmpeg that `doctor --fix` installed into the data directory is put in front
 * of PATH for the studio's processes; a system FFmpeg is used when none is there.
 */
export function withInstalledTools(pathValue, home) {
  const root = path.join(home, "tools", "ffmpeg");
  if (!existsSync(root)) return pathValue;
  const exe = process.platform === "win32" ? ".exe" : "";
  const bins = [root, ...readdirSync(root).map((name) => path.join(root, name))]
    .map((dir) => path.join(dir, "bin"))
    .filter((dir) => existsSync(path.join(dir, `ffmpeg${exe}`)));
  return bins.length
    ? [bins[0], pathValue].filter(Boolean).join(path.delimiter)
    : pathValue;
}

/** CLI overrides remain explicit; bare dev/start never listen on the LAN. */
export function nextServerFlags(flags, env = process.env) {
  const hasHostname = flags.some(
    (flag) =>
      flag === "-H" || flag === "--hostname" || flag.startsWith("--hostname="),
  );
  return hasHostname
    ? flags
    : ["--hostname", env.REEL_BIND_HOST || "127.0.0.1", ...flags];
}

/** Next reloads web modules; the separate dev worker must reload its imports too. */
export function productionWorkerCommand(mode) {
  return [
    process.execPath,
    ...(mode === "dev" ? ["--watch", "--watch-preserve-output"] : []),
    "--import",
    "tsx",
    "scripts/production-worker.ts",
  ];
}

/** A failed web process stops the pair; worker crashes restart with bounded backoff. */
export function supervise({
  web,
  worker,
  env = process.env,
  restartMs = 1000,
  graceMs = 10000,
  maxRestarts = 5,
  stableMs = 60_000,
}) {
  const children = new Set();
  let stopping = false;
  let cleanupPending = 0;
  let restartTimer;
  let restarts = 0;
  let exitCode = 0;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const finish = () => {
    if (stopping && children.size === 0 && cleanupPending === 0)
      resolveDone(exitCode);
  };
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    clearTimeout(restartTimer);
    for (const child of children) {
      cleanupPending += 1;
      void stopProcessTree(child, graceMs)
        .catch((error) => {
          exitCode ||= 1;
          console.error("[supervisor] Cleanup failed", error);
        })
        .finally(() => {
          cleanupPending -= 1;
          finish();
        });
    }
    finish();
  };
  const launch = (name, command) => {
    if (stopping) return;
    const startedAt = Date.now();
    const child = spawn(command[0], command.slice(1), {
      env,
      stdio: "inherit",
      detached: process.platform !== "win32",
    });
    children.add(child);
    console.log(`[supervisor] ${name} started pid=${child.pid}`);
    child.once("error", (error) =>
      console.error(`[supervisor] ${name} spawn failed`, error),
    );
    child.once("close", (code, signal) => {
      children.delete(child);
      console.log(`[supervisor] ${name} exited code=${code} signal=${signal}`);
      if (stopping) return finish();
      if (name === "worker" && Date.now() - startedAt >= stableMs) restarts = 0;
      if (name === "web" || restarts >= maxRestarts) return stop(code || 1);
      restarts += 1;
      console.error(
        `[supervisor] restarting worker (${restarts}/${maxRestarts}); durable leases recover interrupted jobs`,
      );
      restartTimer = setTimeout(
        () => launch("worker", worker),
        restartMs * restarts,
      );
    });
  };
  launch("web", web);
  launch("worker", worker);
  return { stop, done };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const mode = process.argv[2];
  if (!["dev", "start"].includes(mode))
    throw new Error("Expected dev or start");
  process.env.NODE_ENV ??= mode === "dev" ? "development" : "production";
  const require = createRequire(import.meta.url);
  require("@next/env").loadEnvConfig(process.cwd(), mode === "dev");
  const installed = mode === "start" && isInstalledStudio(process.cwd());
  const flags = process.argv.slice(3);
  const portIndex = flags.findIndex(
    (flag) => flag === "-p" || flag === "--port",
  );
  const port =
    portIndex >= 0 ? flags[portIndex + 1] : process.env.PORT || "3000";
  // Record where this engine listens so a local MCP client finds it instead of
  // starting a second one (roadmap M2).
  const home = process.env.REEL_STUDIO_HOME?.trim()
    ? path.resolve(process.env.REEL_STUDIO_HOME)
    : path.join(process.cwd(), ".data");
  if (installed) migrateDatabase();
  const infoPath = path.join(home, "engine.json");
  try {
    mkdirSync(home, { recursive: true });
    writeFileSync(
      infoPath,
      `${JSON.stringify({
        port: Number(port),
        pid: process.pid,
        startedBy:
          process.env.REEL_ENGINE_STARTED_BY === "mcp" ? "mcp" : "user",
        startedAt: new Date().toISOString(),
      })}\n`,
    );
  } catch {
    // Discovery is a convenience; the engine runs without it.
  }
  const forgetInfo = () => {
    try {
      const recorded = JSON.parse(readFileSync(infoPath, "utf8"));
      if (recorded.pid === process.pid) rmSync(infoPath, { force: true });
    } catch {
      // already gone
    }
  };
  process.once("exit", forgetInfo);
  const runner = supervise({
    web: installed
      ? [process.execPath, "server.js"]
      : [
          process.execPath,
          require.resolve("next/dist/bin/next"),
          mode,
          ...nextServerFlags(flags),
        ],
    worker: productionWorkerCommand(mode),
    env: {
      ...process.env,
      ...(installed ? { HOSTNAME: "127.0.0.1", PORT: port } : {}),
      PATH: withInstalledTools(process.env.PATH, home),
      REEL_SUPERVISED_WORKER: "1",
      REEL_WORKER_BASE_URL: `http://127.0.0.1:${port}`,
    },
  });
  process.once("SIGINT", () => runner.stop());
  process.once("SIGTERM", () => runner.stop());
  process.exitCode = await runner.done;
}
