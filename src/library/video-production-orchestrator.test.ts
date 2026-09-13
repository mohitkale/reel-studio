import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveVideoStageMedia } from "@/library/video-stage-media";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { executeVideoProductionJob } from "@/library/video-production-orchestrator";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { videoSnapshotSchema } from "@/production/video-snapshot";
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
      expect.objectContaining({ format: "mp4", checksum: "sha256:verified" }),
    );
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
          verify: async () => ({}),
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
      verify: async () => ({ checksum: "sha256:verified" }),
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
          verify: async () => ({}),
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
