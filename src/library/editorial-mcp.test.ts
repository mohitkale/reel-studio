// @vitest-environment node
import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../mcp/src/client.js", () => ({
  apiGet: mocks.get,
  apiPost: mocks.post,
  apiPatch: vi.fn(),
  apiGetText: vi.fn(),
  apiPut: vi.fn(),
  absoluteUrl: vi.fn(),
  encode: encodeURIComponent,
}));
import { registerTools } from "../../mcp/src/tools";
it("routes editorial tools through the shared guarded REST contracts", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const call = async (name: string, input: unknown) => {
    const [, config, handler] = registerTool.mock.calls.find(
      ([value]) => value === name,
    )!;
    return handler(z.object(config.inputSchema).parse(input));
  };
  mocks.get.mockResolvedValue({});
  mocks.post.mockResolvedValue({});
  await call("get_editorial_script", { scriptId: "script/id" });
  expect(mocks.get).toHaveBeenLastCalledWith(
    "/api/scripts/script%2Fid/editorial",
  );
  await call("control_editorial_storyboard", {
    scriptId: "script/id",
    control: {
      action: "compile",
      expectedRevision: 1,
      budget: { maxProviderCalls: 0 },
    },
  });
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/scripts/script%2Fid/editorial/storyboard",
    { action: "compile", expectedRevision: 1, budget: { maxProviderCalls: 0 } },
  );
  await call("get_editorial_review", { scriptId: "script/id" });
  expect(mocks.get).toHaveBeenLastCalledWith(
    "/api/scripts/script%2Fid/editorial/review",
  );
  await call("control_editorial_revision", {
    scriptId: "script/id",
    control: {
      action: "cancel",
      proposalId: "proposal-1",
      expectedHash: "a".repeat(64),
    },
  });
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/scripts/script%2Fid/editorial/review",
    {
      action: "cancel",
      proposalId: "proposal-1",
      expectedHash: "a".repeat(64),
    },
  );
  mocks.get.mockRejectedValueOnce(new Error("Scope denied"));
  expect(
    (await call("get_editorial_review", { scriptId: "script" })).isError,
  ).toBe(true);
});
