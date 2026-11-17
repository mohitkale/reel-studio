// @vitest-environment node
import { describe, expect, it } from "vitest";

import { POST } from "./route";

const call = (body: unknown) =>
  POST(
    new Request("http://127.0.0.1:3000/api/storyboards/prompt", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/storyboards/prompt", () => {
  it("returns the writer prompt with the brief and the schema filled in", async () => {
    const res = await call({
      topic: "Why the sky is blue",
      targetSeconds: 45,
      format: "16:9",
    });
    expect(res.status).toBe(200);
    const { prompt } = (await res.json()) as { prompt: string };
    expect(prompt).toContain("You write one storyboard for Reel Studio");
    expect(prompt).toContain("Why the sky is blue");
    expect(prompt).toContain('"targetSeconds":45');
    expect(prompt).toContain('"format":"16:9"');
    expect(prompt).toContain("JSON Schema");
    expect(prompt).toContain('"scenes"');
  });

  it("rejects an empty topic", async () => {
    expect((await call({ topic: "  " })).status).toBe(400);
  });
});
