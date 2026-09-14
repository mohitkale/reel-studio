import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync, type ChildProcess } from "node:child_process";
import { makeCancelSignal } from "@remotion/renderer";

const execution = new AsyncLocalStorage<AbortSignal>();
export const withProductionSignal = <T>(signal: AbortSignal, run: () => T): T =>
  execution.run(signal, run);
export const productionSignal = () => execution.getStore();
export function assertProductionActive(signal = productionSignal()) {
  signal?.throwIfAborted();
}

/** Children must be spawned detached on POSIX to own their process group. */
export function cancelChild(
  child: ChildProcess,
  signal = productionSignal(),
  graceMs = 5000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const descendants = new Set<number>();
  const kill = (kind: NodeJS.Signals) => {
    if (kind === "SIGKILL")
      for (const pid of descendants) {
        try {
          process.kill(pid, kind);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH")
            console.error("[production] Child cleanup failed", error);
        }
      }
    if (!child.pid) return;
    try {
      if (process.platform === "win32") child.kill(kind);
      else process.kill(-child.pid, kind);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH")
        console.error("[production] Child cleanup failed", error);
    }
  };
  const abort = () => {
    if (process.platform !== "win32" && child.pid) {
      // Puppeteer can detach Chromium into a different process group. Capture
      // only this child's descendants before the leader has a chance to exit.
      try {
        const rows = execFileSync("ps", ["-axo", "pid=,ppid="], {
          encoding: "utf8",
          timeout: 1000,
        })
          .trim()
          .split("\n")
          .map((row) => row.trim().split(/\s+/).map(Number));
        descendants.add(child.pid);
        let changed = true;
        while (changed) {
          changed = false;
          for (const [pid, parent] of rows)
            if (descendants.has(parent) && !descendants.has(pid)) {
              descendants.add(pid);
              changed = true;
            }
        }
      } catch (error) {
        console.error("[production] Cannot inspect child process tree", error);
      }
    }
    kill("SIGTERM");
    timer = setTimeout(() => kill("SIGKILL"), graceMs);
  };
  signal?.addEventListener("abort", abort, { once: true });
  child.once("close", () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    // The leader may exit before an encoder/browser; reap its remaining group.
    if (signal?.aborted) kill("SIGKILL");
  });
  if (signal?.aborted) abort();
}

export async function cancelableRemotion<T>(
  run: (
    cancelSignal: ReturnType<typeof makeCancelSignal>["cancelSignal"],
  ) => Promise<T>,
  signal = productionSignal(),
): Promise<T> {
  assertProductionActive(signal);
  const { cancelSignal, cancel } = makeCancelSignal();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const result = await run(cancelSignal);
    assertProductionActive(signal);
    return result;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
