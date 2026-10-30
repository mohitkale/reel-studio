// @vitest-environment node
import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evidenceFixture } from "@/research/fixtures";
import { projectCreationRequestSchema } from "@/research/creation-request";
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
it("registers research discovery, durable jobs, evidence import/read and the shared creation schema", async () => {
  mocks.get.mockResolvedValue({});
  mocks.post.mockResolvedValue({});
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  const tool = (name: string) =>
    registerTool.mock.calls.find(([value]) => value === name)!;
  const call = async (name: string, input: unknown) => {
    const [, config, handler] = tool(name);
    return handler(z.object(config.inputSchema).parse(input));
  };
  await call("get_research_capabilities", {});
  expect(mocks.get).toHaveBeenLastCalledWith("/api/research/capabilities");
  const request = {
    idempotencyKey: "mcp-research-1",
    mode: "supplied",
    query: "Product facts",
    sources: [
      { title: "Brief", text: "A local editor uses supplied evidence." },
    ],
  };
  await call("start_research_job", request);
  expect(mocks.post.mock.lastCall![0]).toBe("/api/research/jobs");
  await call("get_research_job", { id: "job/id" });
  expect(mocks.get).toHaveBeenLastCalledWith("/api/research/jobs/job%2Fid");
  await call("cancel_research_job", { id: "job/id" });
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/research/jobs/job%2Fid/cancel",
    {},
  );
  await call("get_research_evidence", { id: "evidence/id" });
  expect(mocks.get).toHaveBeenLastCalledWith(
    "/api/research/evidence/evidence%2Fid",
  );
  await call("import_research_evidence", { evidence: evidenceFixture() });
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/research/evidence",
    evidenceFixture(),
  );
  const input = {
    providerId: "ollama",
    modelId: "writer",
    mode: "idea",
    brief: "A local product",
    evidenceId: "evidence-1",
    directorBudget: { maxPaidCalls: 0 },
  };
  await call("ai_create_project", input);
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/projects/ai",
    projectCreationRequestSchema.parse(input),
  );
  const broken = evidenceFixture();
  broken.claims[0]!.references[0]!.sourceId = "missing";
  expect(
    z
      .object(tool("import_research_evidence")[1].inputSchema)
      .safeParse({ evidence: broken }).success,
  ).toBe(false);
  mocks.get.mockRejectedValueOnce(
    new Error("This token does not grant studio:read"),
  );
  expect((await call("get_research_job", { id: "job" })).isError).toBe(true);
});
