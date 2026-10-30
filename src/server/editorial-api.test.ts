// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  start: vi.fn(),
  run: vi.fn(),
  control: vi.fn(),
  read: vi.fn(),
  change: vi.fn(),
  storyboard: vi.fn(),
  review: vi.fn(),
  readReview: vi.fn(),
}));
vi.mock("@/library/editorial-writing", () => ({
  startEditorialWriting: m.start,
  runEditorialWriting: m.run,
  controlEditorialWriting: m.control,
}));
vi.mock("@/library/repositories/editorial", () => ({
  readEditorialRecord: m.read,
  changeEditorialRecord: m.change,
}));
vi.mock("@/library/editorial-storyboard", () => ({
  controlEditorialStoryboard: m.storyboard,
}));
vi.mock("@/library/editorial-review", () => ({
  controlEditorialReview: m.review,
  readEditorialReview: m.readReview,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
import { POST as create } from "@/app/api/projects/editorial/route";
import {
  POST as writing,
  GET as status,
} from "@/app/api/scripts/[id]/editorial/route";
import { POST as storyboard } from "@/app/api/scripts/[id]/editorial/storyboard/route";
import {
  POST as review,
  GET as findings,
} from "@/app/api/scripts/[id]/editorial/review/route";
const context = { params: Promise.resolve({ id: "fixture" }) };
const req = (
  method = "POST",
  body: unknown = {},
  headers: Record<string, string> = {},
) =>
  new Request("http://localhost:3000/api/scripts/fixture/editorial", {
    method,
    headers: { host: "localhost:3000", ...headers },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REEL_STRICT_AUTH", "1");
  vi.stubEnv("MCP_API_TOKEN", "fixture-editorial-token");
  vi.stubEnv("MCP_NAMED_TOKENS", "[]");
});
afterEach(() => vi.unstubAllEnvs());
it("requires studio authorization before reading bodies, touching storage or scheduling provider work", async () => {
  for (const route of [writing, storyboard, review])
    expect((await route(req(), context)).status).toBe(401);
  expect((await create(req())).status).toBe(401);
  for (const route of [status, findings])
    expect((await route(req("GET"), context)).status).toBe(401);
  for (const mock of Object.values(m)) expect(mock).not.toHaveBeenCalled();
});
it("rejects overspending and widening a visual revision scope at the route boundary", async () => {
  const auth = { authorization: "Bearer fixture-editorial-token" };
  expect(
    (
      await storyboard(
        req(
          "POST",
          {
            action: "compile",
            expectedRevision: 1,
            budget: { maxProviderCalls: 1 },
          },
          auth,
        ),
        context,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await review(
        req(
          "POST",
          {
            action: "preview",
            key: "fixture-key",
            expectedHash: "a".repeat(64),
            sceneId: "scene",
            kind: "change-direction",
            copy: { screenCopy: "Injected", narration: "New copy" },
            budget: { maxProviderCalls: 1 },
          },
          auth,
        ),
        context,
      )
    ).status,
  ).toBe(400);
  expect(m.storyboard).not.toHaveBeenCalled();
  expect(m.review).not.toHaveBeenCalled();
});
