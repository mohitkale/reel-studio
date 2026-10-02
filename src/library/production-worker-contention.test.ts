// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runProductionWorkerOnce } from "./production-worker";
import {
  claimProductionJob,
  heartbeatProductionJob,
  finishProductionJob,
} from "./repositories/production-jobs";
vi.mock("./repositories/production-jobs", () => ({
  claimProductionJob: vi.fn(),
  heartbeatProductionJob: vi.fn(),
  finishProductionJob: vi.fn(),
  releaseProductionJob: vi.fn(),
}));
vi.mock("./editor-render-jobs", () => ({ reconcileRenderJobs: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  vi.mocked(claimProductionJob).mockResolvedValue({
    id: "job",
    kind: "audio",
    inputSnapshot: {},
    state: "running",
    attempt: 1,
    leaseOwner: "worker",
    cancelRequested: false,
    leaseExpiresAt: new Date(101_000),
  });
  vi.mocked(finishProductionJob).mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
it("does not falsely cancel a valid lease during brief SQLite contention", async () => {
  vi.mocked(heartbeatProductionJob)
    .mockRejectedValueOnce(
      Object.assign(new Error("database is locked"), { code: "P1008" }),
    )
    .mockResolvedValue(true);
  expect(
    await runProductionWorkerOnce({
      workerId: "worker",
      leaseMs: 1000,
      execute: async (_job, context) => {
        expect(await context.heartbeat()).toBe(true);
        expect(context.signal.aborted).toBe(false);
      },
    }),
  ).toBe("succeeded");
  expect(finishProductionJob).toHaveBeenCalledWith(
    "job",
    "worker",
    "succeeded",
  );
});
it("stops after the last confirmed lease expires and still honors real cancellation", async () => {
  vi.mocked(heartbeatProductionJob).mockRejectedValue(
    Object.assign(new Error("database is locked"), { code: "P1008" }),
  );
  await runProductionWorkerOnce({
    workerId: "worker",
    leaseMs: 1000,
    execute: async (_job, context) => {
      vi.setSystemTime(102_000);
      await expect(context.heartbeat()).rejects.toThrow("locked");
      expect(context.signal.aborted).toBe(true);
    },
  });
  vi.mocked(heartbeatProductionJob).mockResolvedValue(false);
  expect(
    await runProductionWorkerOnce({
      workerId: "worker",
      execute: async (_job, context) => {
        expect(await context.heartbeat()).toBe(false);
        expect(context.signal.aborted).toBe(true);
      },
    }),
  ).toBe("canceled");
});

it("does not extend its confirmed deadline by the time spent waiting for a lock", async () => {
  vi.mocked(heartbeatProductionJob).mockImplementation(async () => {
    vi.setSystemTime(102_000);
    return true;
  });
  expect(
    await runProductionWorkerOnce({
      workerId: "worker",
      leaseMs: 1000,
      execute: async (_job, context) => {
        expect(await context.heartbeat()).toBe(false);
        expect(context.signal.aborted).toBe(true);
      },
    }),
  ).toBe("canceled");
});
