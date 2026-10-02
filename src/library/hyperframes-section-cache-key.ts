import type { PlanV2Manifest } from "@hyperframes/producer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { renderCacheKey } from "@/library/render-section-cache";

type FrozenDigest = { sha256: string; sizeBytes: number };
const videoMetadataSchema = z
  .object({
    videos: z
      .array(z.object({ id: z.string(), src: z.string() }).passthrough())
      .max(240),
    extracted: z
      .array(
        z.object({ videoId: z.string(), srcPath: z.string() }).passthrough(),
      )
      .max(240),
  })
  .passthrough();

/** The pinned producer records a discarded execution-workspace pathname in
 * extracted video metadata. Canonicalize only that diagnostic field, after
 * validating the real frozen blob and its corresponding compiled media input.
 * All timing, decoder metadata, source bytes and extracted frame hashes remain
 * cache dependencies. Unknown layouts retain conservative raw hashes.
 */
export async function stableHyperframesVideoMetadata(
  planDir: string,
  plan: PlanV2Manifest,
): Promise<FrozenDigest | undefined> {
  const artifact = plan.artifacts.find(
    (entry) => entry.path === "meta/videos.json",
  );
  if (
    !artifact ||
    !["0.8.40", "0.8.111"].includes(plan.producerVersion) ||
    plan.protocol.artifactLayout !== "content-addressed-plan-v2"
  )
    return undefined;
  if (
    !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
    artifact.sizeBytes > 2 * 1024 * 1024
  )
    throw new Error("Invalid frozen native video metadata.");
  const bytes = await fs.readFile(
    path.join(
      planDir,
      "artifacts",
      "sha256",
      artifact.sha256.slice(0, 2),
      artifact.sha256,
    ),
  );
  if (
    bytes.length !== artifact.sizeBytes ||
    createHash("sha256").update(bytes).digest("hex") !== artifact.sha256
  )
    throw new Error("Frozen native video metadata changed.");
  const metadata = videoMetadataSchema.parse(
    JSON.parse(bytes.toString("utf8")),
  );
  const sources = new Map(
    metadata.videos.map((video) => [video.id, video.src]),
  );
  if (sources.size !== metadata.videos.length) return undefined;
  for (const entry of metadata.extracted) {
    const src = sources.get(entry.videoId);
    if (
      !src ||
      !/^[a-zA-Z0-9/._-]+$/.test(src) ||
      src.startsWith("/") ||
      src.split("/").some((part) => part === ".." || part === ".") ||
      !entry.srcPath
        .replaceAll("\\", "/")
        .endsWith(`/.plan-work/compiled/${src}`) ||
      !plan.artifacts.some((input) => input.path === `compiled/${src}`)
    )
      return undefined;
    entry.srcPath = `compiled/${src}`;
  }
  const serialized = JSON.stringify(metadata);
  return {
    sha256: renderCacheKey(metadata),
    sizeBytes: Buffer.byteLength(serialized),
  };
}

/** Silent video depends on frozen chunk inputs, not the newly encoded audio mix.
 * The aggregate plan.json hashes audio too. Native manifest validation remains
 * mandatory before rendering; assembly always uses the fresh complete mix.
 */
export function hyperframesSectionCacheKey(
  plan: PlanV2Manifest,
  chunkIndex?: number,
  videoMetadata?: FrozenDigest,
) {
  return renderCacheKey({
    version: 4,
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
        sha256:
          artifact.path === "meta/videos.json" && videoMetadata
            ? videoMetadata.sha256
            : artifact.sha256,
        sizeBytes:
          artifact.path === "meta/videos.json" && videoMetadata
            ? videoMetadata.sizeBytes
            : artifact.sizeBytes,
        chunks: artifact.chunks,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  });
}
