/**
 * Main-thread controller for in-browser Kokoro TTS.
 *
 * All inference happens in a dedicated Web Worker (see kokoro.worker.ts), so the
 * UI stays responsive even for long scripts. This module owns a single reusable
 * worker, routes per-scene synth requests to it, and generates scenes
 * sequentially so only one scene's audio exists at a time.
 *
 * Client-only: the worker (and the heavy kokoro-js/transformers deps it pulls)
 * is never part of the server bundle.
 */

interface PendingRequest {
  resolve: (wavBase64: string) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
const pending = new Map<number, PendingRequest>();
let onModelProgress: ((fraction: number | undefined) => void) | null = null;
let nextId = 1;

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as {
        type: string;
        id?: number;
        wavBase64?: string;
        message?: string;
        progress?: number;
      };
      if (m.type === "progress") {
        onModelProgress?.(
          typeof m.progress === "number" ? m.progress / 100 : undefined,
        );
        return;
      }
      if (m.id == null) return;
      const req = pending.get(m.id);
      if (!req) return;
      pending.delete(m.id);
      if (m.type === "error") req.reject(new Error(m.message ?? "Kokoro failed"));
      else req.resolve(m.wavBase64 ?? "");
    };
    worker.onerror = (e: ErrorEvent) => {
      const err = new Error(e.message || "Kokoro worker crashed");
      for (const req of pending.values()) req.reject(err);
      pending.clear();
    };
  }
  return worker;
}

function synthOne(text: string, voice: string): Promise<string> {
  const w = ensureWorker();
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "synth", id, text, voice });
  });
}

export interface GenerateScenesOptions {
  voice: string;
  /** Model-download progress 0..1 (first run only). */
  onModelProgress?: (fraction: number | undefined) => void;
  /** Called before synthesizing each scene with (completed, total). */
  onScene?: (completed: number, total: number) => void;
  signal?: AbortSignal;
}

/** Generate base64 WAV beats for every scene, one at a time, in the worker. */
export async function generateScenesToBeats(
  scenes: { id: string; text: string }[],
  opts: GenerateScenesOptions,
): Promise<{ sceneId: string; wavBase64: string }[]> {
  onModelProgress = opts.onModelProgress ?? null;
  const beats: { sceneId: string; wavBase64: string }[] = [];
  try {
    for (let i = 0; i < scenes.length; i++) {
      if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      opts.onScene?.(i, scenes.length);
      const wavBase64 = await synthOne(scenes[i].text, opts.voice);
      beats.push({ sceneId: scenes[i].id, wavBase64 });
    }
  } finally {
    onModelProgress = null;
  }
  return beats;
}

/** Tear down the worker to free the loaded model from memory. */
export function terminateKokoro(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.clear();
}
