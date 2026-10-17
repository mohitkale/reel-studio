// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { RequestAuthorization } from "@/server/auth";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  submit: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  approve: vi.fn(),
  wake: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorizeRequest: mocks.authorize }));
vi.mock("@/library/factory-service", () => ({
  submitFactoryRun: mocks.submit,
  getFactoryRun: mocks.get,
}));
vi.mock("@/library/production-batch-service", () => ({
  cancelProductionBatch: mocks.cancel,
  retryProductionBatch: mocks.retry,
  approveProductionBatch: mocks.approve,
}));
vi.mock("@/library/factory-routes", () => ({ wakeFactoryQueue: mocks.wake }));
import { POST as submit } from "@/app/api/factory/runs/route";
import { POST as control } from "@/app/api/factory/runs/[id]/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockReturnValue({
    origin: "web",
    token: null,
  } satisfies RequestAuthorization);
});
const req = (value: unknown) =>
  new Request("http://localhost/api/factory/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
it("validates factory contracts before jobs and wakes only queued variants", async () => {
  expect(
    (
      await submit(
        req({
          idempotencyKey: "factory-route",
          sourceRevisionId: "source",
          variants: [
            {
              kind: "aspect",
              key: "square",
              label: "Square",
              orientation: "square",
              html: "<script>",
            },
          ],
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.submit).not.toHaveBeenCalled();
  mocks.submit.mockResolvedValue({
    id: "run",
    batch: {
      items: [
        { state: "queued" },
        { state: "awaiting_approval" },
        { state: "succeeded" },
      ],
    },
  });
  expect(
    (
      await submit(
        req({
          idempotencyKey: "factory-route",
          sourceRevisionId: "source",
          variants: [
            {
              kind: "aspect",
              key: "square",
              label: "Square",
              orientation: "square",
            },
          ],
        }),
      )
    ).status,
  ).toBe(202);
  expect(mocks.authorize).toHaveBeenLastCalledWith(
    expect.any(Request),
    "production:submit",
  );
  expect(mocks.wake).toHaveBeenCalledWith(1);
});
it("uses cancellation scope and keeps automatic approval in the first-party studio", async () => {
  const run = { id: "run", batchId: "batch", batch: { items: [] } };
  mocks.get.mockResolvedValue(run);
  expect(
    (
      await control(req({ action: "cancel" }), {
        params: Promise.resolve({ id: "run" }),
      })
    ).status,
  ).toBe(202);
  expect(mocks.authorize).toHaveBeenLastCalledWith(
    expect.any(Request),
    "production:cancel",
  );
  expect(mocks.cancel).toHaveBeenCalledWith("batch");
  mocks.authorize.mockReturnValue({ origin: "mcp", token: { kind: "legacy" } });
  expect(
    (
      await control(req({ action: "approve" }), {
        params: Promise.resolve({ id: "run" }),
      })
    ).status,
  ).toBe(403);
  expect(mocks.approve).not.toHaveBeenCalled();
});
