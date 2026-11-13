// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorizeRead: vi.fn() }));
vi.mock("@/server/auth", () => ({ authorizeRead: mocks.authorizeRead }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/storyboards/lint", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const valid = {
  version: 1,
  title: "T",
  scenes: [
    { type: "statement", headline: "H", narration: "Spoken words here." },
  ],
};

beforeEach(() => vi.resetAllMocks());

it("lints a bare storyboard", async () => {
  const response = await post({ ...valid, extra: true });
  const json = await response.json();
  expect(response.status).toBe(200);
  expect(json.ok).toBe(true);
  expect(json.fixes[0].rule).toBe("drop-unknown-field");
});

it("lints a wrapped reply text with options", async () => {
  const json = await (
    await post({
      storyboard: "```json\n" + JSON.stringify(valid) + "\n```",
      options: { minSeconds: 60 },
    })
  ).json();
  expect(json.ok).toBe(true);
  expect(json.warnings.map((w: { rule: string }) => w.rule)).toContain(
    "duration",
  );
});

it("returns actionable errors with status 200", async () => {
  const json = await (await post({ version: 1, title: "T" })).json();
  expect(json.ok).toBe(false);
  expect(json.storyboard).toBeNull();
  expect(json.errors[0]).toHaveProperty("expected");
});

it("rejects bad options and unauthorized callers", async () => {
  expect(
    (await post({ storyboard: valid, options: { minSeconds: -1 } })).status,
  ).toBe(400);
  mocks.authorizeRead.mockImplementationOnce(() => {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  });
  expect((await post(valid)).status).toBeGreaterThanOrEqual(400);
});
