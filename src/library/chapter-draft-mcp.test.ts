// @vitest-environment node
import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chapterDraftRequestSchema } from "./chapter-draft-input";
import { chapterDraftEditSchema } from "@/production/chapter-draft";
const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("../../mcp/src/client.js", () => ({
  apiPost: mocks.post,
  apiPatch: mocks.patch,
  apiGet: vi.fn(),
  apiGetText: vi.fn(),
  apiPut: vi.fn(),
  absoluteUrl: vi.fn(),
  encode: encodeURIComponent,
}));
import { registerTools } from "../../mcp/src/tools";
it("registers shared topic planning/edit schemas and forwards only the selected operation", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const cases = [
    {
      name: "plan_topic_chapters",
      input: {
        providerId: "openai",
        topic: "Supplied source",
        chapterCount: 2,
        scenesPerChapter: 4,
      },
      schema: chapterDraftRequestSchema,
      call: mocks.post,
    },
    {
      name: "save_topic_chapter_draft",
      input: { expected: null, draft: null },
      schema: chapterDraftEditSchema,
      call: mocks.patch,
    },
  ];
  for (const { name, input, schema, call } of cases) {
    const [, config, handler] = registerTool.mock.calls.find(
      ([registered]) => registered === name,
    )!;
    const parsed = z
      .object(config.inputSchema)
      .parse({ scriptId: "script/id", ...input });
    const { scriptId, ...body } = parsed;
    expect(body).toEqual(schema.parse(input));
    call.mockResolvedValue({ draft: null });
    const response = await handler({ scriptId, ...body });
    expect(response.isError).toBeUndefined();
    expect(call).toHaveBeenCalledExactlyOnceWith(
      "/api/scripts/script%2Fid/chapter-draft",
      body,
    );
  }
});
