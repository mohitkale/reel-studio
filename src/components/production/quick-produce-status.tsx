"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  Loader2,
  RefreshCcw,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
import { stepElapsed } from "@/lib/step-time";
import { useScript } from "@/hooks/script";
import { describeJobProgress } from "@/production/render-estimate";
import { preparedVideoCompositionSchema } from "@/production/video-snapshot";
import {
  useApproveProductionJob,
  useCancelProductionJob,
  useProductionJob,
  useRetryProductionJob,
  type ProductionJobView,
} from "@/hooks/production-jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STAGES = [
  ["validate", "Check the storyboard"],
  ["plan", "Plan the scenes"],
  ["resolve_media", "Find pictures and clips"],
  ["synthesize_audio", "Record the voice"],
  ["time_content", "Time captions and scenes"],
  ["prepare_composition", "Lay out the scenes"],
  ["render_export", "Export the video"],
  ["verify_artifacts", "Check the result"],
] as const;

const DraftPlayer = dynamic(
  () =>
    import("@/components/editor/engine-player").then(
      (module) => module.EnginePlayer,
    ),
  {
    ssr: false,
    loading: () => <p role="status">Opening the draft preview…</p>,
  },
);

/** One symbol and plain words per step state, so a step never reads as a bare code. */
function stepMark(state: string | undefined): string {
  switch (state) {
    case "succeeded":
      return "✓";
    case "running":
      return "●";
    case "failed":
      return "✗";
    case "canceled":
      return "–";
    default:
      return "○";
  }
}
function stepWords(state: string | undefined): string {
  switch (state) {
    case "succeeded":
      return "Done";
    case "running":
      return "Working now";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "Waiting";
  }
}

function shortRevision(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "unavailable";
}

/** Stage, scene and time left, from the benchmark and then the pace so far. */
function JobProgressLine({
  job,
  sceneSeconds,
  now,
}: {
  job: ProductionJobView;
  sceneSeconds: number[];
  now: number;
}) {
  const started = Date.parse(job.startedAt ?? job.createdAt);
  const elapsed = Math.max(0, (now - started) / 1000);
  return (
    <p
      className="text-muted-foreground flex flex-wrap gap-x-3 text-xs"
      data-testid="active-job-progress"
    >
      <span role="status">
        {job.state === "queued"
          ? "Queued for the local worker"
          : describeJobProgress({
              steps: job.steps,
              progress: job.progress,
              sceneSeconds,
              quality: job.quality,
              elapsedSeconds: elapsed,
            })}
      </span>
      <span aria-hidden>{Math.floor(elapsed)} s elapsed</span>
    </p>
  );
}

/** The storyboard's scenes as cards while the video is made, so the wait shows the work. */
function LiveScenes({
  scriptId,
  previews = [],
}: {
  scriptId: string;
  previews?: ProductionJobView["scenePreviews"];
}) {
  const script = useScript(scriptId);
  const scenes = [...(script.data?.scenes ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const thumbnails = new Map(
    previews.map(({ sceneId, downloadUrl }) => [sceneId, downloadUrl]),
  );
  if (scenes.length === 0) return null;
  return (
    <section aria-label="Scenes in this video">
      <p className="text-muted-foreground mb-2 text-xs">
        {scenes.length} scenes, written and checked on this computer
      </p>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene, index) => (
          <li key={scene.id} className="rounded-md border p-2 text-xs">
            {thumbnails.has(scene.id) && (
              <Image
                unoptimized
                src={thumbnails.get(scene.id)!}
                width={240}
                height={240}
                alt=""
                className="bg-muted mb-2 aspect-video w-full rounded object-contain"
              />
            )}
            <span className="text-muted-foreground block">
              Scene {index + 1}
            </span>
            <span className="line-clamp-2 font-medium">{scene.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function QuickProduceStatus({
  jobId,
  scriptId,
  showPreview = true,
}: {
  jobId: string | null;
  scriptId: string;
  showPreview?: boolean;
}) {
  const router = useRouter();
  const query = useProductionJob(jobId);
  const prepared = query.data?.steps.find(
    (step) => step.key === "prepare_composition" && step.state === "succeeded",
  )?.detail;
  const draft = React.useMemo(() => {
    if (
      !prepared ||
      typeof prepared !== "object" ||
      !("composition" in prepared)
    )
      return null;
    const parsed = preparedVideoCompositionSchema.safeParse(
      prepared.composition,
    );
    return parsed.success ? parsed.data : null;
  }, [prepared]);
  const [now, setNow] = React.useState(() => Date.now());
  const cancel = useCancelProductionJob();
  const approve = useApproveProductionJob();
  const retry = useRetryProductionJob();
  const restore = useMutation({
    mutationFn: () =>
      apiPost<{ projectId: string; scriptId: string }>(
        `/api/production-jobs/${jobId}/revision`,
        {},
      ),
    onSuccess: (result) => router.push(`/editor/${result.scriptId}`),
    onError: (error) =>
      toast.error("Could not open the video in the editor", {
        description: (error as Error).message,
      }),
  });
  const produceCurrent = useMutation({
    mutationFn: () =>
      apiPost<{ job: ProductionJobView }>(
        `/api/production-jobs/${jobId}/produce-current`,
        {},
      ),
    onSuccess: ({ job }) => {
      toast.success("Making the updated video");
      router.replace(
        `/editor/${scriptId}?productionJob=${encodeURIComponent(job.id)}`,
      );
    },
    onError: (error) =>
      toast.error("Could not start the updated video", {
        description: (error as Error).message,
      }),
  });

  const stillWorking = ["queued", "running"].includes(query.data?.state ?? "");
  React.useEffect(() => {
    if (!stillWorking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stillWorking]);

  if (!jobId) return null;
  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
          <p role="status">
            Opening your saved video job. The local worker keeps running while
            this page connects.
          </p>
        </CardContent>
      </Card>
    );
  }
  const job = query.data;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  if (!job) return null;
  const active = ["queued", "running", "awaiting_approval"].includes(job.state);

  return (
    <Card className={job.revision?.conflict ? "border-amber-500/60" : ""}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {job.state === "succeeded"
                  ? "Ready to download"
                  : job.state === "failed"
                    ? "The video could not be made"
                    : job.state === "canceled"
                      ? "Stopped. Your draft is saved"
                      : job.state === "awaiting_approval"
                        ? "Waiting for your OK"
                        : "Making your video"}
              </p>
              <Badge
                variant={job.state === "failed" ? "destructive" : "outline"}
              >
                {job.state.replaceAll("_", " ")}
              </Badge>
            </div>
          </div>
          <span className="text-sm font-medium">
            {Math.round(job.progress * 100)}%
          </span>
        </div>

        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${Math.round(job.progress * 100)}%` }}
          />
        </div>
        {stillWorking && (
          <JobProgressLine
            job={job}
            now={now}
            sceneSeconds={
              draft?.props.timeline.map(
                (beat) => beat.durationFrames / draft.props.fps,
              ) ?? []
            }
          />
        )}

        {showPreview && stillWorking && draft && (
          <section aria-label="Draft preview" className="space-y-2">
            <h2 className="text-sm font-semibold">Draft preview</h2>
            <div className="mx-auto max-w-md">
              <DraftPlayer
                {...draft.props}
                totalFrames={draft.totalFrames}
                videoEngine="hyperframes"
                previewQuality="draft"
                loop={false}
              />
            </div>
          </section>
        )}
        {showPreview &&
          job.state === "succeeded" &&
          job.outputs.find((output) => output.format === "mp4") && (
            <video
              aria-label="Finished video"
              controls
              playsInline
              preload="metadata"
              className="mx-auto block max-h-[32rem] max-w-full rounded-lg bg-black"
              src={
                job.outputs.find((output) => output.format === "mp4")!
                  .downloadUrl
              }
            />
          )}
        {active && (
          <LiveScenes
            scriptId={scriptId}
            previews={showPreview ? job.scenePreviews : undefined}
          />
        )}
        <details className="text-sm" open={active || job.state === "failed"}>
          <summary className="cursor-pointer font-medium">
            Steps and details
          </summary>
          <p className="text-muted-foreground mt-1 text-xs">
            Every step runs on this computer; nothing is uploaded unless you
            turned on an online voice or stock media.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Durable job {job.id.slice(-10)} · submitted revision{" "}
            <span className="font-mono">
              {shortRevision(job.revision?.submittedHash)}
            </span>
            {job.revision?.currentHash ? (
              <>
                {" "}
                · current{" "}
                <span className="font-mono">
                  {shortRevision(job.revision.currentHash)}
                </span>
              </>
            ) : null}
          </p>{" "}
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map(([key, label]) => {
              const persisted = job.steps.find((step) => step.key === key);
              return (
                <li
                  key={key}
                  className="rounded-md border px-2.5 py-2 text-xs"
                  aria-current={
                    persisted?.state === "running" ? "step" : undefined
                  }
                >
                  <span className="block font-medium">
                    {stepMark(persisted?.state)} {label}
                  </span>
                  <span className="text-muted-foreground">
                    {stepWords(persisted?.state)}
                    {persisted?.state === "running"
                      ? ` · ${Math.round((persisted?.progress ?? 0) * 100)}%`
                      : ""}
                    {stepElapsed(
                      persisted?.startedAt,
                      persisted?.finishedAt,
                      now,
                    )
                      ? ` · ${stepElapsed(persisted?.startedAt, persisted?.finishedAt, now)}`
                      : ""}
                  </span>
                  {persisted?.state === "failed" && persisted.error ? (
                    <span className="text-destructive mt-1 block">
                      {persisted.error}. Trying again runs this step again and
                      keeps the steps that already finished.
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(job.id)}
                      >
                        <RefreshCcw className="size-3.5" /> Try this step again
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </details>

        {job.revision?.conflict ? (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            This video changed after it was started. This result still shows the
            version that was started; your newer edits are safe.
          </div>
        ) : null}
        {job.error ? (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            {job.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {job.state === "awaiting_approval" ? (
            <Button
              size="sm"
              disabled={approve.isPending}
              onClick={() => approve.mutate(job.id)}
            >
              Make the video
            </Button>
          ) : null}
          {active ? (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(job.id)}
            >
              <StopCircle className="size-3.5" /> Cancel
            </Button>
          ) : null}
          {["failed", "canceled"].includes(job.state) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={retry.isPending}
              onClick={() => retry.mutate(job.id)}
            >
              <RefreshCcw className="size-3.5" /> Try again
            </Button>
          ) : null}
          {job.state === "succeeded" && job.revision ? (
            <Button
              size="sm"
              variant="outline"
              disabled={restore.isPending}
              onClick={() => restore.mutate()}
            >
              <ExternalLink className="size-3.5" /> Open in the editor
            </Button>
          ) : null}
          {job.revision?.conflict ? (
            <Button
              size="sm"
              disabled={produceCurrent.isPending}
              onClick={() => produceCurrent.mutate()}
            >
              {produceCurrent.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="size-3.5" />
              )}
              Make the updated video
            </Button>
          ) : null}
          {job.outputs.map((output) => (
            <Button key={output.id} size="sm" variant="outline" asChild>
              <a href={output.downloadUrl} download>
                <Download className="size-3.5" /> Download{" "}
                {output.format.toUpperCase()}
              </a>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
