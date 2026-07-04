/**
 * In-process job queue for server-side voice generation, mirroring
 * render-queue.ts. Lets POST /api/scripts/:id/takes return immediately with a
 * jobId while synthesis runs in the background, with real per-scene progress
 * streamed over SSE. Module-level state persists across requests in Next.js
 * dev mode (not serverless) — same local-first assumption as the render queue.
 */

import type { VoiceTakeDTO } from "@/lib/dto";

export type VoiceJobStatus =
  | "queued"
  | "synthesizing"
  | "stitching"
  | "done"
  | "error";

export interface VoiceJob {
  id: string;
  status: VoiceJobStatus;
  /** Scenes fully synthesized (cache hit or fresh) so far. */
  scene: number;
  sceneCount: number;
  error?: string;
  /** Set once status === "done". */
  take?: VoiceTakeDTO;
}

const jobs = new Map<string, VoiceJob>();
const subscribers = new Map<string, Set<(job: VoiceJob) => void>>();

export function getVoiceJob(id: string): VoiceJob | undefined {
  return jobs.get(id);
}

export function upsertVoiceJob(job: VoiceJob): void {
  jobs.set(job.id, job);
  subscribers.get(job.id)?.forEach((cb) => cb(job));
}

/** Subscribe to progress events for a job. Returns an unsubscribe function. */
export function subscribeToVoiceJob(
  id: string,
  callback: (job: VoiceJob) => void,
): () => void {
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id)!.add(callback);
  const current = jobs.get(id);
  if (current) callback(current);
  return () => {
    subscribers.get(id)?.delete(callback);
  };
}
