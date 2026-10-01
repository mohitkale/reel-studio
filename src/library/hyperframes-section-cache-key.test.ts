// @vitest-environment node
import { expect, it } from "vitest";
import type { PlanV2Manifest } from "@hyperframes/producer";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  hyperframesSectionCacheKey,
  stableHyperframesVideoMetadata,
} from "./hyperframes-section-cache-key";
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

it("canonicalizes only verified temporary video paths while preserving timing, source and decoder dependencies", async () => {
  const directory = await fs.mkdtemp(
    path.join(tmpdir(), "native-video-cache-"),
  );
  const metadata = (workspace: string) => ({
    videos: [
      {
        id: "video",
        src: "_assets/clip.mp4",
        start: 0,
        end: 30,
        mediaStart: 0,
        loop: false,
      },
    ],
    extracted: [
      {
        videoId: "video",
        srcPath: `${workspace}/.plan-work/compiled/_assets/clip.mp4`,
        fps: 24,
        totalFrames: 192,
        framePattern: "frame_%05d.jpg",
        metadata: { durationSeconds: 8, width: 640, height: 360 },
      },
    ],
    futureDependency: "retain-me",
  });
  async function freeze(value: ReturnType<typeof metadata>) {
    const bytes = Buffer.from(JSON.stringify(value));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const blob = path.join(
      directory,
      "artifacts",
      "sha256",
      sha256.slice(0, 2),
      sha256,
    );
    await fs.mkdir(path.dirname(blob), { recursive: true });
    await fs.writeFile(blob, bytes);
    const plan = {
      protocol: {
        schemaVersion: 2,
        artifactLayout: "content-addressed-plan-v2",
      },
      producerVersion: "0.8.40",
      ffmpegVersion: "pinned",
      width: 1280,
      height: 720,
      fps: 24,
      totalFrames: 720,
      format: "mp4",
      artifacts: [
        {
          path: "meta/videos.json",
          sha256,
          sizeBytes: bytes.length,
          chunks: "all",
        },
        {
          path: "compiled/_assets/clip.mp4",
          sha256: "a".repeat(64),
          sizeBytes: 100,
          chunks: "all",
        },
        {
          path: "video-frames/video/00001.jpg",
          sha256: "b".repeat(64),
          sizeBytes: 100,
          chunks: [0],
        },
      ],
    } as unknown as PlanV2Manifest;
    const digest = await stableHyperframesVideoMetadata(directory, plan);
    return {
      plan,
      digest,
      key: hyperframesSectionCacheKey(plan, 0, digest),
      blob,
    };
  }
  try {
    const first = await freeze(metadata("/temporary/first"));
    const retry = await freeze(metadata("/temporary/different-length/retry"));
    expect(first.digest).toBeDefined();
    expect(retry.digest).toEqual(first.digest);
    expect(retry.key).toBe(first.key);
    expect(hyperframesSectionCacheKey(retry.plan, 0)).not.toBe(
      hyperframesSectionCacheKey(first.plan, 0),
    );
    for (const change of [
      (value: ReturnType<typeof metadata>) => {
        value.videos[0].mediaStart = 1;
      },
      (value: ReturnType<typeof metadata>) => {
        value.videos[0].loop = true;
      },
      (value: ReturnType<typeof metadata>) => {
        value.videos[0].end = 29;
      },
      (value: ReturnType<typeof metadata>) => {
        value.extracted[0].fps = 30;
      },
      (value: ReturnType<typeof metadata>) => {
        value.extracted[0].metadata.durationSeconds = 9;
      },
      (value: ReturnType<typeof metadata>) => {
        value.futureDependency = "changed";
      },
    ]) {
      const value = metadata("/temporary/first");
      change(value);
      expect((await freeze(value)).key).not.toBe(first.key);
    }
    for (const artifactPath of [
      "compiled/_assets/clip.mp4",
      "video-frames/video/00001.jpg",
    ]) {
      const plan = {
        ...first.plan,
        artifacts: first.plan.artifacts.map((artifact) =>
          artifact.path === artifactPath
            ? { ...artifact, sha256: "c".repeat(64) }
            : artifact,
        ),
      };
      expect(hyperframesSectionCacheKey(plan, 0, first.digest)).not.toBe(
        first.key,
      );
    }
    expect(
      await stableHyperframesVideoMetadata(directory, {
        ...first.plan,
        producerVersion: "future",
      }),
    ).toBeUndefined();
    expect(
      await stableHyperframesVideoMetadata(directory, {
        ...first.plan,
        artifacts: first.plan.artifacts.filter(
          (artifact) => !artifact.path.startsWith("compiled/"),
        ),
      }),
    ).toBeUndefined();
    const unsupported = metadata("/temporary/first");
    unsupported.extracted[0].srcPath = "/different-layout/clip.mp4";
    expect((await freeze(unsupported)).digest).toBeUndefined();
    await fs.writeFile(first.blob, "tampered");
    await expect(
      stableHyperframesVideoMetadata(directory, first.plan),
    ).rejects.toThrow("metadata changed");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

it("selects only a native chunk's declared frozen frame dependencies", () => {
  const plan = {
    protocol: { schemaVersion: 2 },
    producerVersion: "0.8.40",
    ffmpegVersion: "test",
    width: 1080,
    height: 1920,
    fps: 30,
    totalFrames: 1800,
    format: "mp4",
    limitations: { videoDependencyMode: "exact-rendered-frames" },
    artifacts: [
      {
        path: "compiled/index.html",
        sha256: "html",
        sizeBytes: 10,
        chunks: "all",
      },
      {
        path: "video-frames/a/001.png",
        sha256: "a",
        sizeBytes: 10,
        chunks: [0],
      },
      {
        path: "video-frames/b/001.png",
        sha256: "b",
        sizeBytes: 10,
        chunks: [1],
      },
    ],
  } as unknown as PlanV2Manifest;
  const changed = {
    ...plan,
    artifacts: plan.artifacts.map((artifact) =>
      artifact.path.includes("/b/")
        ? { ...artifact, sha256: "changed" }
        : artifact,
    ),
  };
  expect(hyperframesSectionCacheKey(changed, 0)).toBe(
    hyperframesSectionCacheKey(plan, 0),
  );
  expect(hyperframesSectionCacheKey(changed, 1)).not.toBe(
    hyperframesSectionCacheKey(plan, 1),
  );
  expect(hyperframesSectionCacheKey(changed)).not.toBe(
    hyperframesSectionCacheKey(plan),
  );
});
