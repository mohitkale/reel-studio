import { AsyncLocalStorage } from "node:async_hooks";
import type { ChildProcess } from "node:child_process";
import { stopProcessTree } from "../../scripts/process-tree.mjs";

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
  let cleanup: Promise<void> | undefined;
  const abort = () => {
    if (cleanup) return;
    cleanup = stopProcessTree(child, graceMs);
    // Observe errors immediately; callers also await cleanup before removing files.
    void cleanup.catch((error: unknown) =>
      console.error("[production] Child cleanup failed", error),
    );
  };
  signal?.addEventListener("abort", abort, { once: true });
  child.once("close", () => signal?.removeEventListener("abort", abort));
  if (signal?.aborted) abort();
  return () => cleanup ?? Promise.resolve();
}
