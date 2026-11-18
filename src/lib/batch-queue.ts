/**
 * The batch queue (roadmap A7): a list of topics made one at a time, with a
 * status per item, retry, pause and resume. These are the rules; the page runs them.
 */
export type BatchStatus = "waiting" | "writing" | "making" | "done" | "failed";

export interface BatchItem {
  id: string;
  topic: string;
  status: BatchStatus;
  jobId?: string;
  podcastId?: string;
  error?: string;
}

export function newItems(topics: string[], now = Date.now()): BatchItem[] {
  return topics.map((topic, i) => ({
    id: `${now}-${i}`,
    topic,
    status: "waiting" as const,
  }));
}

/** The next item to start: the first one still waiting. */
export function nextItem(items: readonly BatchItem[]): BatchItem | undefined {
  return items.find((item) => item.status === "waiting");
}

export function isBusy(items: readonly BatchItem[]): boolean {
  return items.some(
    (item) => item.status === "writing" || item.status === "making",
  );
}

/** "Next up", "2 ahead of it": where a waiting item stands. */
export function queuePosition(
  items: readonly BatchItem[],
  id: string,
): string | undefined {
  const waiting = items.filter((item) => item.status === "waiting");
  const index = waiting.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const ahead = index + (isBusy(items) ? 1 : 0);
  return ahead === 0 ? "Next up" : `${ahead} ahead of it`;
}

export function summarise(items: readonly BatchItem[]) {
  const count = (status: BatchStatus) =>
    items.filter((item) => item.status === status).length;
  return {
    total: items.length,
    done: count("done"),
    failed: count("failed"),
    waiting: count("waiting"),
    working: count("writing") + count("making"),
  };
}

/** Put a failed item back in line. */
export function retry(items: readonly BatchItem[], id: string): BatchItem[] {
  return items.map((item) =>
    item.id === id && item.status === "failed"
      ? { ...item, status: "waiting", error: undefined }
      : item,
  );
}

/** Retry every failed item. */
export function retryAll(items: readonly BatchItem[]): BatchItem[] {
  return items.map((item) =>
    item.status === "failed"
      ? { ...item, status: "waiting", error: undefined }
      : item,
  );
}

/**
 * Read saved items back after a reload. What was being written or made is put
 * back in line: the page that was running it is gone.
 */
export function restoreItems(raw: unknown): BatchItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BatchItem[] = [];
  for (const value of raw.slice(0, 50)) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.topic !== "string") continue;
    const status = item.status;
    const restored: BatchStatus =
      status === "done" || status === "failed" ? status : "waiting";
    out.push({
      id: item.id,
      topic: item.topic.slice(0, 500),
      status: restored,
      ...(restored === "done" && typeof item.jobId === "string"
        ? { jobId: item.jobId }
        : {}),
      ...(restored === "done" && typeof item.podcastId === "string"
        ? { podcastId: item.podcastId }
        : {}),
      ...(restored === "failed" && typeof item.error === "string"
        ? { error: item.error.slice(0, 300) }
        : {}),
    });
  }
  return out;
}
