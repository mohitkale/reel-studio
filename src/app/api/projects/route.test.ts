// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createProject } from "@/library/repositories/projects";
import { z } from "zod";
vi.mock("@/library/repositories/projects", () => ({
  createProject: vi.fn(),
  ensureSampleSeed: vi.fn(),
  listProjects: vi.fn(),
}));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
const request = (body: string) =>
  new Request("http://localhost:3000/api/projects", {
    method: "POST",
    headers: { host: "localhost:3000" },
    body,
  });
describe("project request validation", () => {
  it.each(['{"name":""}', '{"name":42}', "{"])(
    "rejects %s with 400 before repository IO",
    async (body) => {
      vi.stubEnv("REEL_STRICT_AUTH", "");
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(createProject).not.toHaveBeenCalled();
    },
  );
  it("does not classify downstream validation as invalid client input", async () => {
    vi.stubEnv("REEL_STRICT_AUTH", "");
    const invalid = z.object({ output: z.string() }).safeParse({ output: 1 });
    if (invalid.success) throw new Error("Fixture must fail validation");
    vi.mocked(createProject).mockRejectedValue(invalid.error);
    expect((await POST(request('{"name":"Valid"}'))).status).toBe(502);
  });
});
