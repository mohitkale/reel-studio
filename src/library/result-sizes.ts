import { z } from "zod";

import {
  ORIENTATIONS,
  orientationFromDims,
  type Orientation,
} from "@/lib/orientation";
import { submitProduction } from "@/library/production-service";
import {
  getProductionJob,
  getProductionJobByIdempotencyKey,
} from "@/library/repositories/production-jobs";
import { deleteProject } from "@/library/repositories/projects";
import { deleteTake } from "@/library/repositories/takes";
import { restoreProductionRevision } from "@/library/restore-production-revision";
import { videoProductionJobInputSchema } from "@/production/jobs";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { ProviderError } from "@/providers/voice/types";
import type { RequestAuthorization } from "@/server/auth";

const formats = { portrait: "9:16", landscape: "16:9", square: "1:1" };
const compositionStepSchema = z.object({ snapshot: videoSnapshotSchema });
export async function makeResultSizes(
  jobId: string,
  auth: RequestAuthorization,
  serverBaseUrl: string,
) {
  const job = await getProductionJob(jobId);
  if (!job || job.kind !== "video")
    throw new ProviderError("Video result not found", 404);
  if (job.state !== "succeeded")
    throw new ProviderError("Finish the video before making other sizes.", 409);
  const priority = job.priority;

  const input = videoProductionJobInputSchema.parse(
    JSON.parse(job.inputSnapshot),
  );
  const prepared = job.steps.find(
    (step) => step.key === "prepare_composition" && step.state === "succeeded",
  );
  // The completed composition includes the exact words, look, resolved pictures,
  // captions and narration that went into this MP4, even after the script is edited.
  if (!prepared?.detailJson)
    throw new ProviderError(
      "This result does not have a saved composition. Export it again before making other sizes.",
      409,
    );
  const { snapshot } = compositionStepSchema.parse(
    JSON.parse(prepared.detailJson),
  );
  const current =
    input.orientation ??
    orientationFromDims(snapshot.script.width, snapshot.script.height);

  const sizes: Array<{
    format: string;
    jobId?: string;
    current?: boolean;
    error?: string;
  }> = [{ format: formats[current], jobId, current: true }];
  const queued: string[] = [];
  for (const orientation of ORIENTATIONS) {
    if (orientation === current) continue;
    const entry = { format: formats[orientation] };
    try {
      const variant = await makeVariant(orientation);
      sizes.push({ ...entry, jobId: variant.id });
      if (variant.state === "queued") queued.push(variant.id);
    } catch (error) {
      sizes.push({
        ...entry,
        error:
          error instanceof Error ? error.message : "Could not make this size",
      });
    }
  }
  return { sizes, queued };

  async function makeVariant(orientation: Orientation) {
    const key = `result-size:${jobId}:${orientation}`;
    const existing = await getProductionJobByIdempotencyKey(key);
    if (existing) return existing;

    const restored = await restoreProductionRevision(snapshot, orientation);
    const discard = async () => {
      if (restored.restoredTakeId) await deleteTake(restored.restoredTakeId);
      await deleteProject(restored.projectId);
    };
    const variant = await submitProduction({
      request: {
        kind: "video",
        scriptId: restored.scriptId,
        voiceTakeId: restored.restoredTakeId,
        orientation,
        quality: input.quality,
        quickProduce: {
          ...input.quickProduce,
          enabled: true,
          planner: input.quickProduce?.planner ?? "deterministic",
          mediaPreference: input.quickProduce?.mediaPreference ?? "none",
          voice: {
            providerId: "kokoro-server",
            voiceId: "af_heart",
            ...input.quickProduce?.voice,
            enabled: Boolean(
              restored.restoredTakeId && input.quickProduce?.voice.enabled,
            ),
          },
        },
        storyboard: input.storyboard,
        runMode: "automatic",
        priority,
        idempotencyKey: key,
      },
      auth,
      serverBaseUrl,
    }).catch(async (error: unknown) => {
      const submitted = await getProductionJobByIdempotencyKey(key);
      if (submitted) return submitted;
      await discard();
      throw error;
    });
    if (!variant) {
      await discard();
      throw new Error("Could not queue this size");
    }
    if (variant.productionRevision?.scriptId !== restored.scriptId)
      await discard();
    return variant;
  }
}
