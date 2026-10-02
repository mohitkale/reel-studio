import { execFile, execFileSync } from "node:child_process";

/**
 * Stop one owned child and its descendants. POSIX children must own a process
 * group; snapshot detached browser descendants before the leader exits.
 * Windows console processes require taskkill /T /F while the leader is alive.
 * @param {import('node:child_process').ChildProcess} child
 * @param {number} graceMs
 * @returns {Promise<void>}
 */
export function stopProcessTree(child, graceMs = 5000) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve();
  const pid = child.pid;
  if (process.platform === "win32") {
    return new Promise((resolve, reject) => {
      execFile(
        "taskkill",
        ["/PID", String(pid), "/T", "/F"],
        {
          windowsHide: true,
          timeout: 10000,
          maxBuffer: 64 * 1024,
        },
        (error) => {
          // A natural exit racing cancellation is harmless. No shell or global
          // image-name kills; never fall back to killing only the leader.
          if (error && child.exitCode === null && child.signalCode === null)
            reject(error);
          else resolve();
        },
      );
    });
  }
  const descendants = new Set([pid]);
  try {
    const rows = execFileSync("ps", ["-axo", "pid=,ppid="], {
      encoding: "utf8",
      timeout: 1000,
      maxBuffer: 4 * 1024 * 1024,
    })
      .trim()
      .split("\n")
      .map((row) => row.trim().split(/\s+/).map(Number));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, parent] of rows)
        if (descendants.has(parent) && !descendants.has(id)) {
          descendants.add(id);
          changed = true;
        }
    }
  } catch (error) {
    console.error("[process-tree] Cannot inspect descendants", error);
  }
  /** @param {number} target @param {NodeJS.Signals} signal */
  const kill = (target, signal) => {
    try {
      process.kill(target, signal);
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ESRCH")
        console.error("[process-tree] Cleanup failed", error);
    }
  };
  return new Promise((resolve) => {
    let finished = false;
    const force = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.removeListener("close", force);
      kill(-pid, "SIGKILL");
      // Detached browser processes are outside the worker's group.
      for (const id of descendants) if (id !== pid) kill(id, "SIGKILL");
      resolve();
    };
    const timer = setTimeout(force, graceMs);
    child.once("close", force);
    kill(-pid, "SIGTERM");
  });
}
