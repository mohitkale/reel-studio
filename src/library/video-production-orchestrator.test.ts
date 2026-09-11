// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { executeVideoProductionJob } from "@/library/video-production-orchestrator";
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

describe("video production orchestration", () => {
  it("runs the ordered pipeline and records only a verified output", async () => {
    const completed: string[] = [];
    const render = vi.fn(async () => undefined);
    const output = vi.fn(async () => ({ id: "output-1" }) as never);
    await executeVideoProductionJob(
      job,
      { signal: new AbortController().signal, heartbeat: async () => true },
      {
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
});
