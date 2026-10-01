import type { PlanV2Manifest } from "@hyperframes/producer";
import { renderCacheKey } from "@/library/render-section-cache";

/** Silent video depends on frozen chunk inputs, not the newly encoded audio mix.
 * The aggregate plan.json hashes audio too. Native manifest validation remains
 * mandatory before rendering; assembly always uses the fresh complete mix.
 */
export function hyperframesSectionCacheKey(
  plan: PlanV2Manifest,
  chunkIndex?: number,
) {
  return renderCacheKey({
    version: 3,
    chunkIndex,
    engine: "hyperframes",
    protocol: plan.protocol,
    producer: plan.producerVersion,
    ffmpeg: plan.ffmpegVersion,
    dimensions: [plan.width, plan.height, plan.fps, plan.totalFrames],
    format: plan.format,
    limitations: plan.limitations,
    artifacts: plan.artifacts
      .filter(
        (artifact) =>
          artifact.path !== "plan.json" &&
          (artifact.chunks === "all" ||
            (chunkIndex === undefined
              ? artifact.chunks.length > 0
              : artifact.chunks.includes(chunkIndex))),
      )
      .map((artifact) => ({
        path: artifact.path,
        sha256: artifact.sha256,
        sizeBytes: artifact.sizeBytes,
        chunks: artifact.chunks,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  });
}
