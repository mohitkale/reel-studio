// @vitest-environment node
import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { filmSnapshot } from "../../tests/fixtures/film-plan";
import { withResolvedFilmPlan } from "@/production/film-plan";
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
it("reads and checkpoints the same validated document through REST", async () => {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const document = {
    kind: "reel-studio-film-plan",
    version: 1,
    snapshot: withResolvedFilmPlan(filmSnapshot()),
  };
  const [, readConfig, read] = registerTool.mock.calls.find(
    ([name]) => name === "get_film_plan",
  )!;
  mocks.get.mockResolvedValue(document);
  await read(
    z
      .object(readConfig.inputSchema)
      .parse({ scriptId: "script/id", revisionId: "saved/id" }),
  );
  expect(mocks.get).toHaveBeenCalledWith(
    "/api/scripts/script%2Fid/film-plan?revisionId=saved%2Fid",
  );
  const [, config, save] = registerTool.mock.calls.find(
    ([name]) => name === "save_film_plan",
  )!;
  const input = z
    .object(config.inputSchema)
    .parse({ scriptId: "script/id", document });
  mocks.post.mockResolvedValue({ revisionId: "saved" });
  expect((await save(input)).isError).toBeUndefined();
  expect(mocks.post).toHaveBeenCalledWith(
    "/api/scripts/script%2Fid/film-plan",
    { document: input.document },
  );
  expect(
    z
      .object(config.inputSchema)
      .safeParse({ scriptId: "script", document: { ...document, version: 99 } })
      .success,
  ).toBe(false);
});
