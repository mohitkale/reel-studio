"use client";
import { useEffect, useRef } from "react";

/** Abort waiting connections when their owning editor unmounts. */
export function useJobLifetime() {
  const controller = useRef<AbortController | null>(null);
  if (controller.current == null) controller.current = new AbortController();
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  return () => controller.current!.signal;
}

/** One deadline covers SSE and polling; terminal errors are never retried. */
export function waitForJob<T, R>(
  url: string,
  apply: (value: T) => R | undefined,
  signal?: AbortSignal,
  maxMs = 20 * 60 * 1000,
): Promise<R> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const source = new EventSource(`${url}/progress`);
    let settled = false;
    let polling = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result?: R, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(pollTimer);
      source.close();
      controller.abort();
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () =>
      finish(
        undefined,
        signal?.reason ?? new DOMException("Aborted", "AbortError"),
      );
    const deadline = setTimeout(
      () =>
        finish(
          undefined,
          new Error(
            "Generation timed out after 20 minutes; check saved takes before retrying",
          ),
        ),
      maxMs,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    const accept = (value: T) => {
      try {
        const result = apply(value);
        if (result !== undefined) finish(result);
      } catch (error) {
        finish(undefined, error);
      }
    };
    const poll = async () => {
      let value: T | undefined;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });
        if ([401, 403, 404].includes(response.status))
          return finish(
            undefined,
            new Error(`Job unavailable (HTTP ${response.status})`),
          );
        if (response.ok) value = ((await response.json()) as { job: T }).job;
      } catch {
        /* Network errors retry within the original deadline. */
      }
      if (settled) return;
      if (value !== undefined) accept(value);
      if (!settled) pollTimer = setTimeout(() => void poll(), 2000);
    };
    source.onmessage = (event) => {
      let value: T;
      try {
        value = JSON.parse(event.data as string) as T;
      } catch {
        return;
      }
      accept(value);
    };
    source.onerror = () => {
      if (settled || polling) return;
      polling = true;
      source.close();
      void poll();
    };
  });
}
