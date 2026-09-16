"use client";

import * as React from "react";
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
import {
  useCancelProductionJob,
  useProductionJob,
  useRetryProductionJob,
  type ProductionJobView,
} from "@/hooks/production-jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STAGES = [
  ["validate", "Validate"],
  ["plan", "Plan"],
  ["resolve_media", "Resolve media"],
  ["synthesize_audio", "Synthesize or reuse audio"],
  ["time_content", "Time captions and scenes"],
  ["prepare_composition", "Prepare composition"],
  ["render_export", "Render export"],
  ["verify_artifacts", "Verify artifacts"],
] as const;

function shortRevision(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "unavailable";
}

export function QuickProduceStatus({
  jobId,
  scriptId,
}: {
  jobId: string | null;
  scriptId: string;
}) {
  const router = useRouter();
  const query = useProductionJob(jobId);
  const cancel = useCancelProductionJob();
  const retry = useRetryProductionJob();
  const restore = useMutation({
    mutationFn: () =>
      apiPost<{ projectId: string; scriptId: string }>(
        `/api/production-jobs/${jobId}/revision`,
        {},
      ),
    onSuccess: (result) => router.push(`/editor/${result.scriptId}`),
    onError: (error) =>
      toast.error("Could not open the completed revision", {
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
      toast.success("Current revision queued");
      router.replace(
        `/editor/${scriptId}?productionJob=${encodeURIComponent(job.id)}`,
      );
    },
    onError: (error) =>
      toast.error("Could not produce the current revision", {
        description: (error as Error).message,
      }),
  });

  if (!jobId) return null;
  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
          <Loader2 className="size-4 animate-spin" /> Reconnecting to Quick
          Produce…
        </CardContent>
      </Card>
    );
  }
  const job = query.data;
  if (!job) return null;
  const active = ["queued", "running", "awaiting_approval"].includes(job.state);

  return (
    <Card className={job.revision?.conflict ? "border-amber-500/60" : ""}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Quick Produce</p>
              <Badge
                variant={job.state === "failed" ? "destructive" : "outline"}
              >
                {job.state.replaceAll("_", " ")}
              </Badge>
            </div>
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
            </p>
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

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map(([key, label]) => {
            const persisted = job.steps.find((step) => step.key === key);
            return (
              <li key={key} className="rounded-md border px-2.5 py-2 text-xs">
                <span className="block font-medium">{label}</span>
                <span className="text-muted-foreground">
                  {persisted?.state ?? "queued"} ·{" "}
                  {Math.round((persisted?.progress ?? 0) * 100)}%
                </span>
              </li>
            );
          })}
        </ol>

        {job.revision?.conflict ? (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            This project changed after submission. The running result still uses
            the immutable submitted revision; your newer editable work is safe.
          </div>
        ) : null}
        {job.error ? (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            {job.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
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
              <RefreshCcw className="size-3.5" /> Retry submitted revision
            </Button>
          ) : null}
          {job.state === "succeeded" && job.revision ? (
            <Button
              size="sm"
              variant="outline"
              disabled={restore.isPending}
              onClick={() => restore.mutate()}
            >
              <ExternalLink className="size-3.5" /> Open completed revision
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
              Produce current revision
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
