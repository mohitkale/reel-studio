import { AsyncLocalStorage } from "node:async_hooks";
import type { ChildProcess } from "node:child_process";
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
  graceMs = 1500,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const kill = (kind: NodeJS.Signals) => {
    if (!child.pid) return;
    try {
      if (process.platform === "win32") child.kill(kind);
      else process.kill(-child.pid, kind);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const abort = () => {
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
