// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { filmSnapshot } from "../../../../../../tests/fixtures/film-plan";
import { withResolvedFilmPlan } from "@/production/film-plan";
import { AIError } from "@/providers/ai/types";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  authorize: vi.fn(),
  authorizeRead: vi.fn(),
}));
vi.mock("@/library/film-plan-service", () => ({
  readFilmPlanDocument: mocks.read,
  saveFilmPlanDocument: mocks.save,
}));
vi.mock("@/server/auth", () => ({
  authorize: mocks.authorize,
  authorizeRead: mocks.authorizeRead,
}));
import { GET, POST } from "./route";
const context = { params: Promise.resolve({ id: "script" }) };
const document = {
  kind: "reel-studio-film-plan",
  version: 1,
  snapshot: withResolvedFilmPlan(filmSnapshot()),
};
const request = (body: string) =>
  new Request("http://localhost/api/scripts/script/film-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
beforeEach(() => vi.resetAllMocks());
it("authorizes reads and writes before IO", async () => {
  mocks.authorizeRead.mockImplementation(() => {
    throw new AIError("Forbidden", 403);
  });
  mocks.authorize.mockImplementation(() => {
    throw new AIError("Forbidden", 403);
  });
  expect(
    (
      await GET(
        new Request("http://localhost/api/scripts/script/film-plan"),
        context,
      )
    ).status,
  ).toBe(403);
  expect((await POST(request("{}"), context)).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("round-trips JSON through the read and checkpoint endpoints", async () => {
  mocks.read.mockResolvedValue(document);
  const read = await GET(
    new Request(
      "http://localhost/api/scripts/script/film-plan?voiceTakeId=take",
    ),
    context,
  );
  expect(mocks.read).toHaveBeenCalledWith("script", { voiceTakeId: "take" });
  mocks.save.mockResolvedValue({ revisionId: "revision" });
  expect(
    (
      await POST(
        request(JSON.stringify({ document: await read.json() })),
        context,
      )
    ).status,
  ).toBe(201);
  expect(mocks.save.mock.calls[0][1].snapshot.filmPlan).toEqual(
    document.snapshot.filmPlan,
  );
});
it("rejects malformed, oversized, executable and unknown-version documents", async () => {
  for (const body of [
    "{",
    "{}",
    JSON.stringify({ document: { ...document, version: 2 } }),
    JSON.stringify({ document, code: "run()" }),
    " ".repeat(2 * 1024 * 1024 + 1),
  ])
    expect([400, 413]).toContain((await POST(request(body), context)).status);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("rejects conflicting and unknown read parameters and propagates conflicts", async () => {
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/scripts/script/film-plan?revisionId=a&voiceTakeId=b",
        ),
        context,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await GET(
        new Request("http://localhost/api/scripts/script/film-plan?code=x"),
        context,
      )
    ).status,
  ).toBe(400);
  mocks.save.mockRejectedValue(new AIError("Stale plan", 409));
  expect(
    (await POST(request(JSON.stringify({ document })), context)).status,
  ).toBe(409);
});
