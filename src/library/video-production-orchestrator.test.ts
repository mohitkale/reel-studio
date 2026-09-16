import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveVideoStageMedia } from "@/library/video-stage-media";
import { makeSilentWav } from "@/lib/wav";
import type { generateTakeFromVideoSnapshot } from "@/library/take-service";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { executeVideoProductionJob } from "@/library/video-production-orchestrator";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import {
  stockMediaOutputMetadata,
  videoSnapshotSchema,
} from "@/production/video-snapshot";
import type { ClaimedProductionJob } from "@/production/jobs";

const job: ClaimedProductionJob = {
  id: "job-1",
  kind: "video",
  state: "running",
  inputSnapshot: {
    renderId: "render-1",
    scriptId: "script-1",
    quality: "standard",
    serverBaseUrl: "http://localhost:3000",
  },
  attempt: 1,
  cancelRequested: false,
  leaseOwner: "worker-1",
  leaseExpiresAt: new Date("2026-09-12T01:00:00Z"),
};

const snapshot = videoSnapshotSchema.parse({
  version: 1,
  take: null,
  script: {
    id: "script-1",
    projectId: "project-1",
    name: "Fixture",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "remotion",
    scenes: [
      {
        id: "scene-1",
        scriptId: "script-1",
        order: 0,
        templateId: "hook",
        text: "A real saved plan",
        spokenText: null,
        emphasis: [],
        hideText: null,
        selectedVoiceClipId: null,
      },
    ],
    brandTokens: serverDefaultTokens,
    coverUrl: null,
    musicUrl: null,
    musicVolume: 20,
    sfxEnabled: false,
    sfxJson: null,
    hideText: false,
    hideProgressBar: false,
    styleId: "bold-hook",
    energy: "normal",
  },
});
const stageDependencies = {
  capture: async () => snapshot,
  media: async (value: typeof snapshot) => ({ snapshot: value, assets: [] }),
  load: async () => null,
};

describe("video production orchestration", () => {
  it("runs the ordered pipeline and records only a verified output", async () => {
    const completed: string[] = [];
    const render = vi.fn(async () => undefined);
    const output = vi.fn(async () => ({ id: "output-1" }) as never);
    await executeVideoProductionJob(
      job,
      { signal: new AbortController().signal, heartbeat: async () => true },
      {
        ...stageDependencies,
        render,
        artifact: async () => ({
          path: "/tmp/render-1.mp4",
          expectsAudio: false,
        }),
        verify: async () => ({
          bytes: 20_000,
          width: 1080,
          height: 1920,
          duration: 10,
          hasAudio: false,
          checksum: "sha256:verified",
        }),
        step: vi.fn(async (_jobId, key, value) => {
          if (value.state === "succeeded") completed.push(key);
          return {} as never;
        }),
        output,
      },
    );
    expect(render).toHaveBeenCalledOnce();
    expect(completed).toEqual([
      "validate",
      "plan",
      "resolve_media",
      "synthesize_audio",
      "time_content",
      "prepare_composition",
      "render_export",
      "verify_artifacts",
    ]);
    expect(output).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        format: "mp4",
        checksum: "sha256:verified",
        metadata: expect.objectContaining({ stockMedia: [] }),
      }),
    );
  });

  it("keeps immutable stock attribution in output metadata", () => {
    const withStock = videoSnapshotSchema.parse({
      ...snapshot,
      stockMedia: [
        {
          sceneId: "scene-1",
          snapshot: {
            schemaVersion: 1,
            resolvedAt: "2026-09-15T01:00:00.000Z",
            localAssetId: "asset-1",
            contentHash: "b".repeat(64),
            providerSnapshot: {
              providerId: "pexels",
              providerAssetId: "video-42",
              kind: "video",
              previewUrl: "https://videos.example.test/preview.mp4",
              sourcePageUrl: "https://www.example.test/video/42",
              creator: "Example Creator",
              creatorUrl: "https://www.example.test/creator",
              width: 1920,
              height: 1080,
              durationSec: 12,
              orientation: "landscape",
              mimeType: "video/mp4",
              renderRenditions: [
                {
                  id: "hd",
                  url: "https://videos.example.test/video.mp4",
                  width: 1920,
                  height: 1080,
                  durationSec: 12,
                  mimeType: "video/mp4",
                },
              ],
              attribution: {
                text: "Video by Example Creator",
                required: true,
              },
              acquisitionPolicy: "download",
            },
            selectedRendition: {
              id: "hd",
              url: "https://videos.example.test/video.mp4",
              width: 1920,
              height: 1080,
              durationSec: 12,
              mimeType: "video/mp4",
            },
            sourceRevision: {
              capturedAt: "2026-09-15T01:00:00.000Z",
              termsUrl: "https://www.example.test/license",
              termsVersion: "2026-09",
            },
            usageEvent: { state: "not-required" },
          },
        },
      ],
    });

    expect(stockMediaOutputMetadata(withStock)).toEqual([
      expect.objectContaining({
        sceneId: "scene-1",
        providerId: "pexels",
        providerAssetId: "video-42",
        sourcePageUrl: "https://www.example.test/video/42",
        attribution: {
          text: "Video by Example Creator",
          required: true,
        },
        sourceRevision: expect.objectContaining({ termsVersion: "2026-09" }),
        contentHash: "b".repeat(64),
      }),
    ]);
  });

  it("synthesizes Quick Produce audio from the immutable revision", async () => {
    const audioName = `quick-produce-${randomUUID()}.wav`;
    const audioPath = path.resolve("media", "takes", audioName);
    await fs.mkdir(path.dirname(audioPath), { recursive: true });
    await fs.writeFile(audioPath, makeSilentWav(1));
    const original = structuredClone(snapshot);
    const capture = vi.fn(async () => ({
      ...snapshot,
      script: { ...snapshot.script, name: "Edited after submission" },
    }));
    const synthesize = vi.fn(
      async (input: Parameters<typeof generateTakeFromVideoSnapshot>[0]) => ({
        id: "quick-take",
        scriptId: input.snapshot.script.id,
        label: "Quick Produce",
        providerId: "kokoro-server",
        voiceId: "af_heart",
        modelId: null,
        fps: 30,
        totalFrames: 30,
        timeline: [
          {
            sceneId: "scene-1",
            startFrame: 0,
            durationFrames: 30,
            text: "A real saved plan",
          },
        ],
        audioUrl: `/media/takes/${audioName}`,
        isPlaceholder: false,
        source: "oneshot" as const,
        createdAt: new Date().toISOString(),
      }),
    );
    const render = vi.fn(async () => undefined);
    try {
      await executeVideoProductionJob(
        {
          ...job,
          inputSnapshot: {
            renderId: "render-1",
            scriptId: "script-1",
            snapshot: original,
            quality: "standard",
            serverBaseUrl: "http://localhost:3000",
            productionRevisionId: "revision-1",
            revisionHash: "a".repeat(64),
            quickProduce: {
              enabled: true,
              planner: "deterministic",
              mediaPreference: "none",
              voice: {
                enabled: true,
                providerId: "kokoro-server",
                voiceId: "af_heart",
              },
            },
          },
        },
        { signal: new AbortController().signal, heartbeat: async () => true },
        {
          ...stageDependencies,
          capture,
          synthesize,
          render,
          artifact: async () => ({
            path: "/tmp/quick-produce.mp4",
            expectsAudio: true,
          }),
          verify: async () => ({ checksum: "sha256:quick-produce" }),
          step: vi.fn(async () => ({}) as never),
          output: vi.fn(async () => ({}) as never),
        },
      );
      expect(capture).not.toHaveBeenCalled();
      expect(synthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: expect.objectContaining({
            script: expect.objectContaining({ name: "Fixture" }),
          }),
        }),
      );
      expect(render).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: expect.objectContaining({
            take: expect.objectContaining({ id: "quick-take" }),
          }),
        }),
      );
    } finally {
      await fs.rm(audioPath, { force: true });
    }
  });

  it("stops before rendering when ownership or cancellation heartbeat fails", async () => {
    const render = vi.fn(async () => undefined);
    await expect(
      executeVideoProductionJob(
        job,
        { signal: new AbortController().signal, heartbeat: async () => false },
        {
          ...stageDependencies,
          render,
          artifact: async () => ({ path: "unused", expectsAudio: false }),
          verify: async () => ({ checksum: "sha256:fixture" }),
          step: vi.fn(async () => ({}) as never),
          output: vi.fn(async () => ({}) as never),
        },
      ),
    ).rejects.toThrow("Production canceled");
    expect(render).not.toHaveBeenCalled();
  });

  it("does not record output when artifact verification fails", async () => {
    const output = vi.fn(async () => ({}) as never);
    await expect(
      executeVideoProductionJob(
        job,
        { signal: new AbortController().signal, heartbeat: async () => true },
        {
          ...stageDependencies,
          render: async () => undefined,
          artifact: async () => ({
            path: "/tmp/corrupt.mp4",
            expectsAudio: true,
          }),
          verify: async () => {
            throw new Error("Rendered MP4 is missing expected audio");
          },
          step: vi.fn(async () => ({}) as never),
          output,
        },
      ),
    ).rejects.toThrow("missing expected audio");
    expect(output).not.toHaveBeenCalled();
  });
  it("resumes saved stages after render failure and freezes the original revision", async () => {
    const rows = new Map<
      string,
      { state: string; cacheKey: string; detailJson: string }
    >();
    const capture = vi.fn(async () => structuredClone(snapshot));
    const media = vi.fn(stageDependencies.media);
    const render = vi
      .fn()
      .mockRejectedValueOnce(new Error("encoder interrupted"))
      .mockResolvedValue(undefined);
    let artifactChecksum = "sha256:verified";
    const deps = {
      capture,
      media,
      render,
      load: async (_id: string, key: string) =>
        (rows.get(key) as never) ?? null,
      step: async (
        _id: string,
        key: string,
        value: { state: string; cacheKey?: string; detail?: unknown },
      ) => {
        rows.set(key, {
          state: value.state,
          cacheKey: value.cacheKey!,
          detailJson: JSON.stringify(value.detail ?? null),
        });
        return {} as never;
      },
      artifact: async () => ({ path: "/tmp/result.mp4", expectsAudio: false }),
      verify: async () => ({ checksum: artifactChecksum }),
      output: vi.fn(async () => ({}) as never),
    };
    const context = {
      signal: new AbortController().signal,
      heartbeat: async () => true,
    };
    await expect(executeVideoProductionJob(job, context, deps)).rejects.toThrow(
      "encoder interrupted",
    );
    expect(rows.get("prepare_composition")?.state).toBe("succeeded");
    capture.mockResolvedValue({
      ...snapshot,
      script: { ...snapshot.script, name: "Edited later" },
    });
    await executeVideoProductionJob({ ...job, attempt: 2 }, context, deps);
    expect(capture).toHaveBeenCalledOnce();
    expect(media).toHaveBeenCalledOnce();
    expect(render.mock.calls[1][0].snapshot.script.name).toBe("Fixture");
    await executeVideoProductionJob({ ...job, attempt: 3 }, context, deps);
    expect(render).toHaveBeenCalledTimes(2);
    artifactChecksum = "sha256:replaced";
    await executeVideoProductionJob({ ...job, attempt: 4 }, context, deps);
    expect(render).toHaveBeenCalledTimes(3);
    const previousTiming = rows.get("time_content")?.detailJson;
    const revised = structuredClone(snapshot);
    revised.script.scenes[0].text =
      "A longer revised narration must invalidate silent timing. ".repeat(10);
    await executeVideoProductionJob(
      {
        ...job,
        attempt: 4,
        inputSnapshot: {
          renderId: "render-1",
          scriptId: "script-1",
          snapshot: revised,
        },
      },
      context,
      deps,
    );
    expect(render).toHaveBeenCalledTimes(4);
    expect(rows.get("time_content")?.detailJson).not.toBe(previousTiming);

    for (const row of rows.values()) {
      expect(row.cacheKey).toHaveLength(64);
      expect(JSON.parse(row.detailJson)).not.toBeNull();
    }
  });
  it.each([
    "validate",
    "plan",
    "resolve_media",
    "synthesize_audio",
    "time_content",
    "prepare_composition",
    "render_export",
    "verify_artifacts",
  ])("cancels at %s without publishing an output", async (target) => {
    const controller = new AbortController();
    const output = vi.fn(async () => ({}) as never);
    const completed: string[] = [];
    await expect(
      executeVideoProductionJob(
        job,
        { signal: controller.signal, heartbeat: async () => true },
        {
          ...stageDependencies,
          render: async () => undefined,
          artifact: async () => ({ path: "unused", expectsAudio: false }),
          verify: async () => ({ checksum: "sha256:fixture" }),
          output,
          step: async (_id, key, value) => {
            if (key === target && value.state === "running") controller.abort();
            if (value.state === "succeeded") completed.push(key);
            return {} as never;
          },
        },
      ),
    ).rejects.toThrow("Production canceled");
    expect(completed).not.toContain(target);
    expect(output).not.toHaveBeenCalled();
  });
  it("freezes selected local media and keeps remote sources network-dependent", async () => {
    const name = `pr1-${randomUUID()}.wav`;
    const source = path.resolve("media", name);
    await fs.mkdir(path.dirname(source), { recursive: true });
    const content = Buffer.from(randomUUID());
    await fs.writeFile(source, content);
    let copied: string | undefined;
    try {
      const input = structuredClone(snapshot);
      input.script.musicUrl = `/media/${name}`;
      input.script.coverUrl =
        "https://images.unsplash.com/photo-fixture?ixid=retained";
      const resolved = await resolveVideoStageMedia(
        input,
        "http://localhost:3000",
      );
      copied = path.resolve(
        "media",
        resolved.snapshot.script.musicUrl!.slice(7),
      );
      await fs.writeFile(copied, "truncated cache");
      await resolveVideoStageMedia(input, "http://localhost:3000");
      expect(await fs.readFile(copied)).toEqual(content);
      await fs.writeFile(source, "edited later");
      expect(await fs.readFile(copied)).toEqual(content);
      expect(resolved.snapshot.script.coverUrl).toBe(input.script.coverUrl);
      expect(
        resolved.assets.find((asset) => asset.url === input.script.coverUrl)
          ?.checksum,
      ).toBeNull();
    } finally {
      await fs.rm(source, { force: true });
      if (copied) await fs.rm(copied, { force: true });
    }
  });
});
