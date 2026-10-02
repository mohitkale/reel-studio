/** Keep only the latest pending snapshot; serialize writes and flush before terminal state. */
export function createProgressWriter<T>(
  write: (value: T) => Promise<unknown>,
  intervalMs = 250,
) {
  let pending: { value: T } | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = -Infinity;
  let failure: unknown;
  let closed = false;
  const schedule = () => {
    if (closed || running || !pending || timer) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void run().catch(() => {});
      },
      Math.max(0, last + intervalMs - Date.now()),
    );
  };
  const run = () => {
    if (running) return running;
    const next = pending;
    pending = undefined;
    if (!next || closed) return Promise.resolve();
    running = Promise.resolve()
      .then(() => write(next.value))
      .then(
        () => {
          failure = undefined;
        },
        (error) => {
          failure = error;
        },
      )
      .finally(() => {
        running = undefined;
        last = Date.now();
        schedule();
      });
    return running;
  };
  return {
    push(value: T, immediate = false) {
      if (closed) return;
      pending = { value };
      if (immediate) {
        clearTimeout(timer);
        timer = undefined;
        void run().catch(() => {});
      } else schedule();
    },
    async flush() {
      clearTimeout(timer);
      timer = undefined;
      while (running || pending) {
        await (running ?? run());
        clearTimeout(timer);
        timer = undefined;
      }
      if (failure) throw failure;
    },
    async stop() {
      closed = true;
      pending = undefined;
      clearTimeout(timer);
      timer = undefined;
      await running;
    },
  };
}
