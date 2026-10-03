"use client";

import Link from "next/link";
import { useProductionJob } from "@/hooks/production-jobs";
import { useScript } from "@/hooks/script";
import { QuickProduceStatus } from "./quick-produce-status";
import { PromptCreator } from "@/components/projects/prompt-creator";
import { Button } from "@/components/ui/button";

function Remix({ scriptId }: { scriptId: string }) {
  const script = useScript(scriptId);
  if (!script.data) return null;
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Remix this video
      </summary>
      <div className="mt-4">
        <PromptCreator
          initialBrief={script.data.scenes
            .map((scene) => scene.spokenText ?? scene.text)
            .join("\n\n")}
          initialPresetId={script.data.productionPreset?.id}
        />
      </div>
    </details>
  );
}
export function ProductionResult({ jobId }: { jobId: string }) {
  const query = useProductionJob(jobId);
  if (query.isLoading) return <p role="status">Loading your video…</p>;
  if (query.isError || !query.data?.revision)
    return (
      <div role="alert">
        {query.error?.message ?? "This result is unavailable."}{" "}
        <Link href="/" className="underline">
          Back to creation
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
          <Button variant="outline" asChild>
            <Link
              href={`/editor/${scriptId}?productionJob=${encodeURIComponent(jobId)}`}
            >
              Edit video
            </Link>
          </Button>
        </div>
      </div>
      <QuickProduceStatus jobId={jobId} scriptId={scriptId} />
      <Remix scriptId={scriptId} />
    </div>
  );
}
