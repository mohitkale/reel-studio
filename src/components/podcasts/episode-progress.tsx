"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { apiGet } from "@/lib/api-client";

interface EpisodeJob {
  job: {
    status: "queued" | "synthesizing" | "stitching" | "done" | "error";
    scene: number;
    sceneCount: number;
    error: string | null;
  };
}

/**
 * Shown on a podcast page opened from a one-step episode (Create's Podcast chip):
 * the voices are being recorded, so say so, and refresh the page's takes when done.
 */
export function EpisodeProgress({
  podcastId,
  jobId,
}: {
  podcastId: string;
  jobId: string;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["episode-job", jobId],
    queryFn: () =>
      apiGet<EpisodeJob>(`/api/podcasts/${podcastId}/takes/${jobId}`),
    refetchInterval: (q) =>
      ["done", "error"].includes(q.state.data?.job.status ?? "") ? false : 2000,
  });
  const job = query.data?.job;
  const done = job?.status === "done";
  useEffect(() => {
    if (done)
      void client.invalidateQueries({ queryKey: ["podcast", podcastId] });
  }, [done, client, podcastId]);

  if (query.isError || job?.status === "error")
    return (
      <p
        role="alert"
        className="text-destructive rounded-lg border p-3 text-sm"
      >
        The episode could not be made
        {job?.error ? `: ${job.error}` : "."} Use Generate below to try again.
      </p>
    );
  if (!job || done) return null;
  const percent = job.sceneCount
    ? Math.round((job.scene / job.sceneCount) * 100)
    : 0;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border p-3 text-sm"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Making the episode on this computer: recording the voices, adding the
      music and mastering the level
      {job.sceneCount
        ? ` (${job.scene} of ${job.sceneCount} lines, ${percent}%)`
        : ""}
      …
    </div>
  );
}
