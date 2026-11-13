// @vitest-environment node
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { executeVideoProductionJob } from "@/library/video-production-orchestrator";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { makeSilentWav } from "@/lib/wav";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import type { ClaimedProductionJob } from "@/production/jobs";

const snapshot = videoSnapshotSchema.parse({
  version: 1,
  take: null,
  script: {
    id: "script-1",
    projectId: "project-1",
    name: "Storyboard",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "hyperframes",
    scenes: [
      {
        id: "scene-1",
        scriptId: "script-1",
        order: 0,
        templateId: "hf-opener",
        text: "Hello",
        spokenText: "Hello there, this is a short test of captions.",
        emphasis: [],
        hideText: null,
        selectedVoiceClipId: null,
      },
      {
        id: "scene-2",
        scriptId: "script-1",
        order: 1,
        templateId: "hf-cta",
        text: "Bye",
        spokenText: "Try it today.",
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

const storyboardMeta = {
  hash: "a".repeat(64),
  title: "Storyboard",
  fixes: ["format: Mapped"],
  warnings: ["scenes.0: body is not shown yet"],
};

function job(extra: Record<string, unknown>): ClaimedProductionJob {
  return {
    id: "job-1",
    kind: "video",
    state: "running",
    inputSnapshot: {
      renderId: "render-1",
      scriptId: "script-1",
      snapshot,
      quality: "standard",
      serverBaseUrl: "http://localhost:3000",
      productionRevisionId: "revision-1",
      revisionHash: "b".repeat(64),
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
      ...extra,
    },
    attempt: 1,
    cancelRequested: false,
    leaseOwner: "worker-1",
    leaseExpiresAt: new Date("2026-09-12T01:00:00Z"),
  };
}

async function run(
  extra: Record<string, unknown>,
  sheet: () => Promise<void> = async () => undefined,
) {
  const audioName = `storyboard-job-${randomUUID()}.wav`;
  const audioPath = path.resolve("media", "takes", audioName);
  await fs.mkdir(path.dirname(audioPath), { recursive: true });
  await fs.writeFile(audioPath, makeSilentWav(4));
  const render = vi.fn<(...args: unknown[]) => Promise<undefined>>(
    async () => undefined,
  );
  const output = vi.fn<(...args: unknown[]) => Promise<never>>(
    async () => ({}) as never,
  );
  const contactSheet = vi.fn<(...args: unknown[]) => Promise<void>>(async () =>
    sheet(),
  );
  try {
    await executeVideoProductionJob(
      job(extra),
      { signal: new AbortController().signal, heartbeat: async () => true },
      {
        capture: async () => snapshot,
        media: async (value: typeof snapshot) => ({
          snapshot: value,
          assets: [],
        }),
        load: async () => null,
        synthesize: async (input) => ({
          id: "take-1",
          scriptId: input.snapshot.script.id,
          label: "Quick Produce",
          providerId: "kokoro-server",
          voiceId: "af_heart",
          modelId: null,
          fps: 30,
          totalFrames: 120,
          timeline: [
            {
              sceneId: "scene-1",
              startFrame: 0,
              durationFrames: 90,
              text: "Hello there, this is a short test of captions.",
            },
            {
              sceneId: "scene-2",
              startFrame: 90,
              durationFrames: 30,
              text: "Try it today.",
            },
          ],
          audioUrl: `/media/takes/${audioName}`,
          isPlaceholder: false,
          source: "oneshot" as const,
          createdAt: "2026-11-13T00:00:00.000Z",
        }),
        render,
        artifact: async () => ({
          path: "/tmp/storyboard-job.mp4",
          expectsAudio: true,
        }),
        verify: async () => ({ checksum: "sha256:x", duration: 4 }),
        step: vi.fn(async () => ({}) as never),
        output,
        contactSheet,
      },
    );
  } finally {
    await fs.rm(audioPath, { force: true });
  }
  return { render, output, contactSheet };
}

describe("storyboard production jobs", () => {
  it("adds automatic captions, a contact sheet and the storyboard report to the output", async () => {
    const { render, output, contactSheet } = await run({
      captions: "auto",
      storyboard: storyboardMeta,
    });

    const rendered = render.mock.calls[0]![0] as unknown as {
      snapshot: {
        script: { captionTracks: Array<{ enabled: boolean; cues: unknown[] }> };
      };
    };
    const track = rendered.snapshot.script.captionTracks[0]!;
    expect(track.enabled).toBe(true);
    expect(track.cues.length).toBeGreaterThan(1);

    expect(contactSheet).toHaveBeenCalledTimes(1);
    const sheet = contactSheet.mock.calls[0]![0] as unknown as {
      times: number[];
      columns: number;
      outPath: string;
    };
    expect(sheet.times).toHaveLength(2);
    expect(sheet.outPath).toBe("/tmp/storyboard-job.contact-sheet.jpg");

    const video = output.mock.calls.at(-1)![1] as unknown as {
      metadata: Record<string, unknown>;
    };
    expect(video.metadata).toMatchObject({
      captions: "auto",
      storyboard: storyboardMeta,
    });
    expect(video.metadata.contactSheet).toEqual(
      expect.stringContaining("contact-sheet.jpg"),
    );
  });

  it("leaves captions out when the storyboard turns them off", async () => {
    const { render } = await run({
      captions: "off",
      storyboard: storyboardMeta,
    });
    const rendered = render.mock.calls[0]![0] as unknown as {
      snapshot: { script: { captionTracks?: unknown[] } };
    };
    expect(rendered.snapshot.script.captionTracks ?? []).toHaveLength(0);
  });

  it("changes nothing for jobs that are not storyboard jobs", async () => {
    const { render, output, contactSheet } = await run({});
    const rendered = render.mock.calls[0]![0] as unknown as {
      snapshot: { script: { captionTracks?: unknown[] } };
    };
    expect(rendered.snapshot.script.captionTracks ?? []).toHaveLength(0);
    expect(contactSheet).not.toHaveBeenCalled();
    expect(
      (
        output.mock.calls.at(-1)![1] as unknown as {
          metadata: Record<string, unknown>;
        }
      ).metadata,
    ).not.toHaveProperty("storyboard");
  });

  it("keeps the video when the contact sheet fails", async () => {
    const { output } = await run(
      { captions: "auto", storyboard: storyboardMeta },
      async () => {
        throw new Error("ffmpeg missing");
      },
    );
    const video = output.mock.calls.at(-1)![1] as unknown as {
      metadata: Record<string, unknown>;
    };
    expect(video.metadata.contactSheet).toBeNull();
    expect(video.metadata.storyboard).toEqual(storyboardMeta);
  });
});
