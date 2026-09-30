// @vitest-environment node
import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { aiEnhanceRequestSchema } from "./ai-enhance-input";
const post = vi.hoisted(() => vi.fn());
vi.mock("../../mcp/src/client.js", () => ({
  apiPost: post,
  apiGet: vi.fn(),
  apiGetText: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  absoluteUrl: vi.fn(),
  encode: encodeURIComponent,
}));
import { registerTools } from "../../mcp/src/tools";
it("exposes the shared append schema and forwards one named-chapter request to REST", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const [, config, handler] = registerTool.mock.calls.find(
    ([name]) => name === "ai_generate_scenes",
  )!;
  const toolSchema = z.object(config.inputSchema);
  const request = {
    scriptId: "script/id",
    providerId: "openai",
    mode: "append",
    brief: "Explain the next topic",
    chapterTitle: " Next ",
    sceneCount: 1,
    mediaPreference: "none",
  };
  const { scriptId, ...input } = toolSchema.parse(request);
  expect(input).toEqual(aiEnhanceRequestSchema.parse(request));
  post.mockResolvedValue({
    script: { chapterPlan: { chapters: [{ title: "Next" }] } },
  });
  const result = await handler({ scriptId, ...input });
  expect(post).toHaveBeenCalledExactlyOnceWith(
    "/api/scripts/script%2Fid/ai",
    input,
  );
  expect(result.isError).toBeUndefined();
  for (const change of [{ sceneCount: 21 }, { chapterTitle: " " }])
    expect(toolSchema.safeParse({ ...request, ...change }).success).toBe(false);
});
