// @vitest-environment node
import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../mcp/src/client.js", () => ({
  apiPost: mocks.post,
  apiPatch: vi.fn(),
  apiGet: vi.fn(),
  apiGetText: vi.fn(),
  apiPut: vi.fn(),
  absoluteUrl: vi.fn(),
  encode: encodeURIComponent,
}));
import { registerTools } from "../../mcp/src/tools";
it("forwards reviewed music and take to the shared cut proposal endpoint", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const [, config, handler] = registerTool.mock.calls.find(
    ([name]) => name === "suggest_narration_cuts",
  )!;
  const schema = z.object(config.inputSchema);
  const body = {
    takeId: "take",
    reviewed: true,
    expectedMusicMap: {
      version: 1,
      sourceUrl: "/music/a.wav",
      sourceHash: "a".repeat(64),
      durationSeconds: 4,
      bpm: 120,
      offsetSeconds: 0,
      confidence: 0.8,
      method: "manual",
      disabledBeats: [],
      dropSeconds: null,
    },
  };
  expect(
    schema.safeParse({ scriptId: "s", ...body, reviewed: false }).success,
  ).toBe(false);
  mocks.post.mockResolvedValue({ suggestions: [] });
  const result = await handler(
    schema.parse({ scriptId: "script/id", ...body }),
  );
  expect(result.isError).toBeUndefined();
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/scripts/script%2Fid/cut-suggestions",
    body,
  );
});
