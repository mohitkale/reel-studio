// @vitest-environment node
import { expect, it } from "vitest";
import type { PlanV2Manifest } from "@hyperframes/producer";
import { hyperframesSectionCacheKey } from "./hyperframes-section-cache-key";
it("reuses silent frames across freshly encoded audio while invalidating every frozen visual input and encoder setting", () => {
  const plan: PlanV2Manifest = {
    protocol: {
      schemaVersion: 2,
      artifactLayout: "content-addressed-plan-v2",
      hashSchema: "hyperframes-plan-manifest-hash-v2",
    },
    planHash: "a".repeat(64),
    sourcePlanV1Hash: "b".repeat(64),
    chunkCount: 2,
    totalFrames: 960,
    fps: 30,
    width: 1080,
    height: 1920,
    format: "mp4",
    ffmpegVersion: "pinned-ffmpeg",
    producerVersion: "0.8.40",
    limitations: { videoDependencyMode: "exact-rendered-frames" },
    artifacts: [
      {
        path: "compiled/index.html",
        sha256: "c".repeat(64),
        sizeBytes: 100,
        chunks: "all",
        assembler: false,
      },
      {
        path: "meta/encoder.json",
        sha256: "d".repeat(64),
        sizeBytes: 100,
        chunks: "all",
        assembler: true,
      },
      {
        path: "compiled/_assets/vo.wav",
        sha256: "e".repeat(64),
        sizeBytes: 100,
        chunks: "all",
        assembler: false,
      },
      {
        path: "audio.m4a",
        sha256: "f".repeat(64),
        sizeBytes: 100,
        chunks: [],
        assembler: true,
      },
      {
        path: "plan.json",
        sha256: "a".repeat(64),
        sizeBytes: 100,
        chunks: "all",
        assembler: true,
      },
    ],
  };
  const key = hyperframesSectionCacheKey(plan);
  const retry = {
    ...plan,
    planHash: "1".repeat(64),
    sourcePlanV1Hash: "2".repeat(64),
    artifacts: plan.artifacts.map((artifact) =>
      ["audio.m4a", "plan.json"].includes(artifact.path)
        ? { ...artifact, sha256: "3".repeat(64) }
        : artifact,
    ),
  };
  expect(hyperframesSectionCacheKey(retry)).toBe(key);
  expect(
    hyperframesSectionCacheKey({
      ...plan,
      artifacts: [...plan.artifacts].reverse(),
    }),
  ).toBe(key);
  for (const index of [0, 1, 2])
    expect(
      hyperframesSectionCacheKey({
        ...plan,
        artifacts: plan.artifacts.map((artifact, position) =>
          position === index
            ? { ...artifact, sha256: "4".repeat(64) }
            : artifact,
        ),
      }),
    ).not.toBe(key);
  expect(hyperframesSectionCacheKey({ ...plan, fps: 24 })).not.toBe(key);
  expect(
    hyperframesSectionCacheKey({ ...plan, producerVersion: "next" }),
  ).not.toBe(key);
});
