import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/** A failed web process stops the pair; worker crashes restart with bounded backoff. */
export function supervise({
  web,
  worker,
  env = process.env,
  restartMs = 1000,
  graceMs = 10000,
  maxRestarts = 5,
}) {
  const children = new Set();
  let stopping = false;
  let restartTimer;
  let restarts = 0;
  let exitCode = 0;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const finish = () => {
    if (stopping && children.size === 0) resolveDone(exitCode);
  };
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    clearTimeout(restartTimer);
    for (const child of children) {
      if (process.platform === "win32") child.kill("SIGTERM");
      else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
      const timer = setTimeout(() => {
        try {
          if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH")
            console.error("[supervisor] cleanup failed", error);
        }
      }, graceMs);
      child.once("close", () => {
        clearTimeout(timer);
        if (process.platform !== "win32") {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") console.error(error);
          }
        }
      });
    }
    finish();
  };
  const launch = (name, command) => {
    if (stopping) return;
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
  const flags = process.argv.slice(3);
  const portIndex = flags.findIndex(
    (flag) => flag === "-p" || flag === "--port",
  );
  const port =
    portIndex >= 0 ? flags[portIndex + 1] : process.env.PORT || "3000";
  const runner = supervise({
    web: [
      process.execPath,
      require.resolve("next/dist/bin/next"),
      mode,
      ...process.argv.slice(3),
    ],
    worker: [
      process.execPath,
      "--import",
      "tsx",
      "scripts/production-worker.ts",
    ],
    env: {
      ...process.env,
      REEL_SUPERVISED_WORKER: "1",
      REEL_WORKER_BASE_URL: `http://127.0.0.1:${port}`,
    },
  });
  process.once("SIGINT", () => runner.stop());
  process.once("SIGTERM", () => runner.stop());
  process.exitCode = await runner.done;
}
