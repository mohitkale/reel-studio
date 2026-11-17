/** "12 s" or "1 min 05 s": how long a step took, or has been running. */
export function stepElapsed(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
  now: number,
): string | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  const end = finishedAt ? Date.parse(finishedAt) : now;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
