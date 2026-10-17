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
it("forwards shared series/run schemas to the same REST services with explicit idempotency", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const [, config, submit] = registerTool.mock.calls.find(
    ([name]) => name === "create_factory_run",
  )!;
  const value = z
    .object(config.inputSchema)
    .parse({
      idempotencyKey: "mcp-factory",
      sourceRevisionId: "source",
      variants: [
        {
          kind: "cutdown",
          key: "short",
          label: "Short",
          orientation: "portrait",
          sceneIds: ["a", "c"],
        },
      ],
    });
  mocks.post.mockResolvedValue({ run: { id: "run" } });
  expect((await submit(value)).isError).toBeUndefined();
  expect(mocks.post).toHaveBeenCalledWith("/api/factory/runs", value);
  const [, readConfig, read] = registerTool.mock.calls.find(
    ([name]) => name === "get_factory_revision",
  )!;
  await read(z.object(readConfig.inputSchema).parse({ id: "revision/id" }));
  expect(mocks.get).toHaveBeenCalledWith(
    "/api/factory/revisions/revision%2Fid",
  );
  expect(
    z
      .object(config.inputSchema)
      .safeParse({ ...value, variants: Array(7).fill({kind:"aspect",key:"square",label:"Square",orientation:"square"}) })
      .success,
  ).toBe(false);
});
