// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { produceContentRequestSchema } from "@/production/api";
import { submitProduction } from "./production-service";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  enqueue: vi.fn(),
  createRender: vi.fn(),
}));
vi.mock("@/library/video-snapshot", () => ({
  captureVideoSnapshot: mocks.capture,
}));
vi.mock("@/library/repositories/renders", () => ({
  createRender: mocks.createRender,
}));
vi.mock("@/library/repositories/production-jobs", () => ({
  getProductionJobByIdempotencyKey: async () => null,
  enqueueProductionJob: mocks.enqueue,
  appendProductionJobEvent: async () => undefined,
}));
const fixture = videoSnapshotSchema.parse({
  version: 1,
  take: null,
  script: {
    id: "s",
    projectId: "p",
    name: "Timing",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "hyperframes",
    brandTokens: serverDefaultTokens,
    coverUrl: null,
    musicUrl: null,
    musicVolume: 20,
    sfxEnabled: false,
    sfxJson: null,
    hideText: false,
    hideProgressBar: false,
    styleId: "clean-story",
    energy: "normal",
    chapterPlan: {
      version: "1.0.0",
      chapters: [{ id: "c", title: "Opening", firstSceneId: "a" }],
    },
    scenes: [
      {
        id: "a",
        scriptId: "s",
        order: 0,
        templateId: "hf-statement",
        text: "Visible title",
        spokenText: "Narration",
        emphasis: [],
        hideText: null,
        selectedVoiceClipId: null,
      },
    ],
  },
});
function withTake(seconds: number, text = "Narration") {
  return {
    ...fixture,
    take: {
      id: "take",
      scriptId: "s",
      label: null,
      providerId: "fixture",
      voiceId: "fixture",
      modelId: null,
      fps: 30,
      totalFrames: seconds * 30,
      timeline: [
        { sceneId: "a", startFrame: 0, durationFrames: seconds * 30, text },
      ],
      audioUrl: "/media/takes/test.wav",
      isPlaceholder: false,
      source: "oneshot" as const,
      createdAt: new Date().toISOString(),
    },
  };
}
const request = produceContentRequestSchema.parse({
  kind: "video",
  scriptId: "s",
  idempotencyKey: "policy-proof",
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createRender.mockResolvedValue({ id: "render" });
  mocks.enqueue.mockResolvedValue({ id: "job" });
});
const submit = () =>
  submitProduction({
    request,
    auth: { origin: "web", token: null },
    serverBaseUrl: "http://localhost:3000",
  });

it("uses only selected matching narration timing and freezes chapter policy", async () => {
  mocks.capture.mockResolvedValue(fixture);
  await submit();
  expect(mocks.capture).toHaveBeenCalledWith("s", undefined);
  expect(mocks.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      inputSnapshot: expect.objectContaining({
        snapshot: fixture,
        maxDurationSeconds: 300,
      }),
    }),
  );
  mocks.capture.mockResolvedValue(withTake(210, "Stale words"));
  await expect(submit()).resolves.toBeNull();
});
it("includes cover duration and rejects long unchaptered work before creating a render", async () => {
  mocks.capture.mockResolvedValue({
    ...withTake(300),
    script: { ...fixture.script, coverUrl: "/media/cover.png" },
  });
  await expect(submit()).rejects.toThrow(/300 seconds/);
  mocks.capture.mockResolvedValue({
    ...withTake(210),
    script: { ...fixture.script, chapterPlan: undefined },
  });
  await expect(submit()).rejects.toThrow(/180 seconds/);
  expect(mocks.createRender).not.toHaveBeenCalled();
});
it("freezes and enforces a named MCP token's smaller duration allowance", async () => {
  const auth = {
    origin: "mcp" as const,
    token: {
      kind: "named" as const,
      record: {
        id: "token",
        name: "Fixture",
        tokenHash: "0".repeat(64),
        scopes: ["studio:read", "production:automatic"] as const,
        allowedProviders: [],
        paidProviders: [],
        maxDurationSeconds: 180,
        maxBatchSize: 1,
        paidRequestLimit: 0,
        paidRequestsUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      },
    },
  };
  mocks.capture.mockResolvedValue(withTake(210));
  await expect(
    submitProduction({
      request,
      auth: {
        ...auth,
        token: {
          ...auth.token,
          record: {
            ...auth.token.record,
            scopes: [...auth.token.record.scopes],
          },
        },
      },
      serverBaseUrl: "http://localhost:3000",
    }),
  ).rejects.toThrow(/token's 180s limit/);
  mocks.capture.mockResolvedValue(fixture);
  await submitProduction({
    request,
    auth: {
      ...auth,
      token: {
        ...auth.token,
        record: { ...auth.token.record, scopes: [...auth.token.record.scopes] },
      },
    },
    serverBaseUrl: "http://localhost:3000",
  });
  expect(mocks.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      inputSnapshot: expect.objectContaining({ maxDurationSeconds: 180 }),
    }),
  );
});
