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
it("forwards explicit chapter motif changes and rejects arbitrary choreography", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const [, config, handler] = registerTool.mock.calls.find(
    ([name]) => name === "replan_motion_direction",
  )!;
  const schema = z.object(config.inputSchema);
  expect(
    schema.safeParse({ scriptId: "script", chapterMotifs: "freeform" }).success,
  ).toBe(false);
  for (const chapterMotifs of [true, false]) {
    mocks.post.mockResolvedValue({ result: { state: "planned" } });
    const result = await handler(
      schema.parse({ scriptId: "script/id", chapterMotifs }),
    );
    expect(result.isError).toBeUndefined();
    expect(mocks.post).toHaveBeenLastCalledWith(
      "/api/scripts/script%2Fid/motion",
      { chapterMotifs },
    );
  }
});
