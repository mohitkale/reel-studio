import { SSE_HEADERS } from "./sse";
/** Database-backed SSE with one in-flight read and a bounded output queue. */
export function progressResponse<T>(
  req: Request,
  initial: T,
  read: () => Promise<T | null | undefined>,
  terminal: (value: T) => boolean,
  intervalMs = 1000,
) {
  let dispose = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let closed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let previous = "";
        let lastSent = 0;
        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearTimeout(timer);
          req.signal.removeEventListener("abort", abort);
        };
        const close = () => {
          cleanup();
          controller.close();
        };
        const abort = () => {
          if (!closed) close();
        };
        dispose = cleanup;
        req.signal.addEventListener("abort", abort, { once: true });
        const send = (value: T, first = false) => {
          if (closed) return;
          const data = JSON.stringify(value);
          // Slow consumers receive the latest snapshot after draining, never an unbounded backlog.
          if (first || (controller.desiredSize ?? 0) > 0) {
            if (data !== previous) {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              previous = data;
              lastSent = Date.now();
            } else if (Date.now() - lastSent >= 5000) {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
              lastSent = Date.now();
            }
            if (terminal(value)) close();
          }
        };
        const tick = async () => {
          try {
            const value = await read();
            if (closed) return;
            if (!value) return close();
            send(value);
            if (!closed) timer = setTimeout(() => void tick(), intervalMs);
          } catch (error) {
            if (!closed) {
              cleanup();
              controller.error(error);
            }
          }
        };
        if (req.signal.aborted) return close();
        send(initial, true);
        if (!closed) timer = setTimeout(() => void tick(), intervalMs);
      },
      cancel() {
        dispose();
      },
    },
    { highWaterMark: 1 },
  );
  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}
