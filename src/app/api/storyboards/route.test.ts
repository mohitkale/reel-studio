// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  authorizeRequest: vi.fn(),
  produce: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorizeRequest: mocks.authorizeRequest }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/server/app-config", () => ({ getConfig: mocks.config }));
vi.mock("@/library/production-worker", () => ({
  runProductionWorkerOnce: vi.fn(),
}));
vi.mock("@/library/production-job-executor", () => ({
  executeProductionJob: vi.fn(),
}));
vi.mock("@/library/storyboard-production", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/library/storyboard-production")>()),
  produceFromStoryboard: mocks.produce,
}));

import { StoryboardLintError } from "@/library/storyboard-production";
import { POST } from "./route";

const post = (body: unknown, query = "") =>
  POST(
    new Request(`http://localhost:3000/api/storyboards${query}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const storyboard = {
  version: 1,
  title: "T",
  scenes: [{ type: "hook", headline: "H", narration: "Spoken words." }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorizeRequest.mockReturnValue({ origin: "web", token: null });
});

it("queues a job for a bare storyboard and starts the worker", async () => {
  mocks.produce.mockResolvedValue({
    dryRun: false,
    jobId: "j",
    projectId: "p",
    state: "queued",
    reused: false,
  });
  const response = await post(storyboard);
  expect(response.status).toBe(202);
  expect((await response.json()).jobId).toBe("j");
  expect(mocks.produce.mock.calls[0]![0]).toEqual(storyboard);
  expect(mocks.after).toHaveBeenCalledTimes(1);
});

it("takes options from the query or from a wrapper", async () => {
  mocks.produce.mockResolvedValue({ dryRun: true, plan: {} });
  expect((await post(storyboard, "?dryRun=1&quality=draft")).status).toBe(200);
  expect(mocks.produce.mock.calls[0]![1]).toMatchObject({
    dryRun: true,
    quality: "draft",
    serverBaseUrl: "http://localhost:3000",
  });
  await post({ storyboard, force: true });
  expect(mocks.produce.mock.calls[1]![0]).toEqual(storyboard);
  expect(mocks.produce.mock.calls[1]![1]).toMatchObject({ force: true });
  expect(mocks.after).not.toHaveBeenCalled();
});

it("returns 200 without a new worker run for a reused job", async () => {
  mocks.produce.mockResolvedValue({
    dryRun: false,
    jobId: "old",
    state: "queued",
    reused: true,
  });
  expect((await post(storyboard)).status).toBe(200);
  expect(mocks.after).not.toHaveBeenCalled();
});

it("answers 422 with actionable errors for an unrepairable storyboard", async () => {
  mocks.produce.mockRejectedValue(
    new StoryboardLintError({
      storyboard: null,
      fixes: [],
      warnings: [],
      errors: [
        {
          path: "scenes",
          message: "Required",
          expected: "scenes",
          example: "[]",
        },
      ],
    }),
  );
  const response = await post({ version: 1, title: "T" });
  const json = await response.json();
  expect(response.status).toBe(422);
  expect(json.errors[0]).toMatchObject({ path: "scenes", expected: "scenes" });
});

it("rejects unknown options and unauthorized callers", async () => {
  expect((await post(storyboard, "?nope=1")).status).toBe(400);
  mocks.authorizeRequest.mockImplementationOnce(() => {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  });
  expect((await post(storyboard)).status).toBeGreaterThanOrEqual(400);
});

it("passes review through and does not start the worker for a job waiting for approval", async () => {
  mocks.produce.mockResolvedValue({
    dryRun: false,
    jobId: "j",
    projectId: "p",
    state: "awaiting_approval",
    reused: false,
  });
  const response = await post({ storyboard, review: true });
  expect(response.status).toBe(202);
  expect(mocks.produce.mock.calls[0]![1]).toMatchObject({ review: true });
  expect(mocks.after).not.toHaveBeenCalled();
});

it("fills in what the storyboard leaves out from a named series, and keeps what it sets", async () => {
  mocks.config.mockResolvedValue({
    series: [
      {
        name: "Daily tips",
        theme: "bold-pop",
        music: "upbeat-pop",
        format: "9:16",
      },
    ],
  });
  mocks.produce.mockResolvedValue({
    dryRun: false,
    jobId: "j",
    projectId: "p",
    state: "queued",
    reused: false,
  });
  const response = await post({
    storyboard: { ...storyboard, theme: "neon" },
    series: "daily TIPS",
  });
  expect(response.status).toBe(202);
  const sent = mocks.produce.mock.calls[0]![0] as Record<string, unknown>;
  expect(sent).toMatchObject({
    theme: "neon",
    music: "upbeat-pop",
    format: "9:16",
  });
  // The series name is not a production option.
  expect(mocks.produce.mock.calls[0]![1]).not.toHaveProperty("series");
});

it("says so when the series does not exist", async () => {
  mocks.config.mockResolvedValue({ series: [] });
  const response = await post({ storyboard, series: "Nope" });
  expect(response.status).toBe(404);
  expect(JSON.stringify(await response.json())).toContain("no series called");
  expect(mocks.produce).not.toHaveBeenCalled();
});
