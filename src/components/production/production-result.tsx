"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost } from "@/lib/api-client";
import { useProductionJob } from "@/hooks/production-jobs";
import { useScript } from "@/hooks/script";
import { QuickProduceStatus } from "./quick-produce-status";
import { ChangeVideo } from "./change-video";
import { ResultActions } from "./result-actions";
import { PromptCreator } from "@/components/projects/prompt-creator";
import { CreateWithAIDialog } from "@/components/projects/create-with-ai-dialog";
import { EvidenceReview } from "@/components/projects/evidence-review";
import { Button } from "@/components/ui/button";

/** A short random seed; the look it produces is fully reproducible. */
function newLookSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Re-roll the look: a new seed re-plans layouts, arrangements, motion and
 * camera for the same storyboard, then the video is produced again.
 */
function ShuffleLook({ jobId, scriptId }: { jobId: string; scriptId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const script = useScript(scriptId);
  const shuffle = useMutation({
    mutationFn: async () => {
      await apiPatch(`/api/scripts/${scriptId}`, { lookSeed: newLookSeed() });
      return apiPost<{ job: { id: string } }>(
        `/api/production-jobs/${jobId}/produce-current`,
        {},
      );
    },
    onSuccess: ({ job }) => {
      void qc.invalidateQueries({ queryKey: ["script", scriptId] });
      toast.success("New look queued");
      router.push(`/results/${job.id}`);
    },
    onError: (error) =>
      toast.error("Could not shuffle the look", {
        description: (error as Error).message,
      }),
  });
  // Only storyboard videos have a look seed.
  if (!script.data?.lookSeed) return null;
  const locked = script.data.lookLocked === true;
  return (
    <Button
      variant="outline"
      disabled={locked || shuffle.isPending}
      title={
        locked
          ? "This video's look is locked by its series"
          : "Try a different look for the same story"
      }
      onClick={() => shuffle.mutate()}
    >
      <Shuffle className="size-4" aria-hidden /> Shuffle look
    </Button>
  );
}

function Remix({ scriptId }: { scriptId: string }) {
  const script = useScript(scriptId);
  if (!script.data) return null;
  return (
    <div className="space-y-4">
      {script.data.researchEvidence && (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Review sources
          </summary>
          <div className="mt-4">
            <EvidenceReview evidence={script.data.researchEvidence} />
          </div>
        </details>
      )}
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Remix this video
        </summary>
        <div className="mt-4">
          {script.data.creationSettings ? (
            <CreateWithAIDialog
              initialSettings={script.data.creationSettings}
              initialEvidence={script.data.researchEvidence}
              trigger={<Button>Remix with saved settings</Button>}
            />
          ) : (
            <PromptCreator
              initialBrief={script.data.scenes
                .map((scene) => scene.spokenText ?? scene.text)
                .join("\n\n")}
              initialPresetId={script.data.productionPreset?.id}
            />
          )}
        </div>
      </details>
    </div>
  );
}
export function ProductionResult({
  jobId,
  previousJobId,
}: {
  jobId: string;
  /** The version this one replaced, so a change can be undone without making it again. */
  previousJobId?: string;
}) {
  const query = useProductionJob(jobId);
  if (query.isLoading) return <p role="status">Loading your video…</p>;
  if (query.isError || !query.data?.revision)
    return (
      <div role="alert">
        {query.error?.message ?? "This result is unavailable."}{" "}
        <Link href="/" className="underline">
          Back to Create
        </Link>
      </div>
    );
  const scriptId = query.data.revision.scriptId;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your video</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/">Create another</Link>
          </Button>
          <ShuffleLook jobId={jobId} scriptId={scriptId} />
          <Button variant="outline" asChild>
            <Link
              href={`/editor/${scriptId}?productionJob=${encodeURIComponent(jobId)}`}
            >
              Open full editor
            </Link>
          </Button>
        </div>
      </div>
      {previousJobId && (
        <p className="text-sm">
          Not what you wanted?{" "}
          <Link
            href={`/results/${previousJobId}`}
            className="underline underline-offset-2"
          >
            Go back to the previous version
          </Link>{" "}
          (it is kept, so nothing is made again).
        </p>
      )}
      <QuickProduceStatus jobId={jobId} scriptId={scriptId} />
      {query.data.state === "succeeded" && (
        <>
          <ResultActions scriptId={scriptId} quality={query.data.quality} />
          <ChangeVideo jobId={jobId} scriptId={scriptId} />
        </>
      )}
      <Remix scriptId={scriptId} />
    </div>
  );
}
