function aborted(signal: AbortSignal) {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}
export async function abortable<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    void promise.catch(() => {});
    signal.throwIfAborted();
  }
  let onAbort!: () => void;
  const interruption = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(aborted(signal));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, interruption]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** The deadline covers headers AND body consumption. Cancellation releases both readers and timers. */
export async function fetchWithDeadline(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
  mapError: (error: unknown) => unknown = (error) => error,
): Promise<Response> {
  const timeout = new AbortController();
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout.signal])
    : timeout.signal;
  const timer = setTimeout(
    () =>
      timeout.abort(
        new DOMException("Request deadline exceeded", "TimeoutError"),
      ),
    timeoutMs,
  );
  const cleanup = () => clearTimeout(timer);
  try {
    signal.throwIfAborted();
    const pending = fetch(url, { ...init, signal });
    void pending.then(
      (response) => {
        if (signal.aborted) void response.body?.cancel().catch(() => {});
      },
      () => {},
    );
    const response = await abortable(pending, signal);
    if (!response.body) {
      cleanup();
      return response;
    }
    const reader = response.body.getReader();
    let ended = false;
    let received = 0;
    let onAbort: () => void;
    const finish = () => {
      ended = true;
      cleanup();
      signal.removeEventListener("abort", onAbort);
    };
    const release = () => {
      if (ended) return;
      finish();
      void reader.cancel().catch(() => {});
    };
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          onAbort = () => {
            if (!ended) {
              release();
              controller.error(mapError(aborted(signal)));
            }
          };
          signal.addEventListener("abort", onAbort, { once: true });
          if (signal.aborted) onAbort();
        },
        async pull(controller) {
          try {
            const chunk = await abortable(reader.read(), signal);
            if (ended) return;
            if (chunk.done) {
              finish();
              reader.releaseLock();
              controller.close();
            } else {
              received += chunk.value.byteLength;
              if (received > 128 * 1024 * 1024)
                throw new Error("Provider response exceeds 128 MiB");
              controller.enqueue(chunk.value);
            }
          } catch (error) {
            if (!ended) {
              release();
              controller.error(mapError(error));
            }
          }
        },
        cancel() {
          release();
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    cleanup();
    throw mapError(error);
  }
}
