// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const { authorize, getScript, update, createMany, transaction } = vi.hoisted(
  () => ({
    authorize: vi.fn(),
    getScript: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
    transaction: vi.fn(),
  }),
);
vi.mock("@/server/auth", () => ({ authorize }));
vi.mock("@/library/repositories/scripts", () => ({ getScript }));
vi.mock("@/library/db", () => ({
  prisma: {
    scene: { update, createMany, deleteMany: vi.fn() },
    $transaction: transaction,
  },
}));
import { POST } from "./route";
const direction = { version: 1, role: "quote", composition: "layered-title" };
const request = (scene: Record<string, unknown>) =>
  new Request("http://localhost/api/scripts/script/undo", {
    method: "POST",
    body: JSON.stringify({
      scenes: [
        {
          templateId: "hf-quote",
          text: "Keep every word.",
          emphasis: [],
          visual: null,
          direction,
          ...scene,
        },
      ],
    }),
  });
const context = { params: Promise.resolve({ id: "script" }) };
beforeEach(() => {
  vi.resetAllMocks();
  getScript.mockResolvedValue({ id: "script", scenes: [{ id: "scene" }] });
});
it("restores saved direction with scene identity during undo", async () => {
  expect((await POST(request({ id: "scene" }), context)).status).toBe(200);
  expect(JSON.parse(update.mock.calls[0][0].data.layoutJson).direction).toEqual(
    direction,
  );
  expect(update.mock.calls[0][0].where).toEqual({ id: "scene" });
});
it("preserves direction when importing JSON and rejects executable/unknown direction fields", async () => {
  expect((await POST(request({}), context)).status).toBe(200);
  expect(
    JSON.parse(createMany.mock.calls[0][0].data[0].layoutJson).direction,
  ).toEqual(direction);
  transaction.mockClear();
  expect(
    (
      await POST(
        request({ direction: { ...direction, html: "<script>" } }),
        context,
      )
    ).status,
  ).toBe(400);
  expect(transaction).not.toHaveBeenCalled();
});
