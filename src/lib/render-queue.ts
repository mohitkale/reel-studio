export interface RenderJob {
  id: string;
  progress: number;
  status: "queued" | "bundling" | "rendering" | "done" | "error";
  error?: string;
  outputUrl?: string;
}

// Keyed by render DB id.
const jobs = new Map<string, RenderJob>();

// SSE subscribers: each entry is a list of callbacks that receive progress events.
const subscribers = new Map<string, Set<(job: RenderJob) => void>>();

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function upsertJob(job: RenderJob): void {
  jobs.delete(job.id);
  jobs.set(job.id, job);
  while (jobs.size > 256) jobs.delete(jobs.keys().next().value!);
  // Notify any SSE subscribers waiting on this job.
  subscribers.get(job.id)?.forEach((cb) => cb(job));
}

/** Subscribe to progress events for a job. Returns an unsubscribe function. */
export function subscribeToJob(
  id: string,
  callback: (job: RenderJob) => void,
): () => void {
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id)!.add(callback);
  // Immediately fire with current state if any.
  const current = jobs.get(id);
  if (current) callback(current);
  return () => {
    const set = subscribers.get(id);
    set?.delete(callback);
    if (!set?.size) subscribers.delete(id);
  };
}
