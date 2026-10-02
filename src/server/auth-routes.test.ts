// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  GET as projects,
  POST as createProject,
} from "@/app/api/projects/route";
import { GET as renderProgress } from "@/app/api/renders/[id]/progress/route";
import { GET as voiceProgress } from "@/app/api/scripts/[id]/takes/[jobId]/progress/route";
import { GET as keys } from "@/app/api/ai/keys/route";
import { POST as approve } from "@/app/api/renders/[id]/approve/route";
import { GET as media } from "@/app/media/[...path]/route";
import { proxy } from "@/proxy";
import { ensureSampleSeed } from "@/library/repositories/projects";
import { getRender } from "@/library/repositories/renders";
import { getEditorVoiceJob } from "@/library/editor-jobs";
import { approveEditorRender } from "@/library/editor-render-jobs";
import { getAssetStore } from "@/library/storage";

vi.mock("@/library/repositories/projects", () => ({
  ensureSampleSeed: vi.fn(),
  listProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
}));
vi.mock("@/library/repositories/renders", () => ({
  getRender: vi.fn(),
  approveEditorRender: vi.fn(),
}));
vi.mock("@/library/editor-render-jobs", () => ({
  approveEditorRender: vi.fn(),
}));
vi.mock("@/lib/render-queue", () => ({ subscribeToJob: vi.fn() }));
vi.mock("@/library/editor-jobs", () => ({
  getEditorVoiceJob: vi.fn(),
  subscribeToVoiceJob: vi.fn(),
}));
vi.mock("@/library/storage", () => ({ getAssetStore: vi.fn() }));

const endpoints = [
  { name: "project list", call: (r: NextRequest) => projects(r) },
  { name: "project creation", call: (r: NextRequest) => createProject(r) },
  {
    name: "render SSE",
    call: (r: NextRequest) =>
      renderProgress(r, { params: Promise.resolve({ id: "test" }) }),
  },
  {
    name: "voice SSE",
    call: (r: NextRequest) =>
      voiceProgress(r, {
        params: Promise.resolve({ id: "test", jobId: "test" }),
      }),
  },
  { name: "provider key status", call: (r: NextRequest) => keys(r) },
  {
    name: "human approval",
    call: (r: NextRequest) =>
      approve(r, { params: Promise.resolve({ id: "test" }) }),
  },
  {
    name: "media",
    call: (r: NextRequest) =>
      media(r, { params: Promise.resolve({ path: ["test.mp4"] }) }),
  },
];

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("route authorization before IO", () => {
  it.each(endpoints)(
    "$name rejects reconstructed localhost with a foreign Host",
    async ({ call }) => {
      vi.stubEnv("REEL_ALLOWED_HOSTS", "");
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: { host: "192.168.1.20:3000", "sec-fetch-site": "same-origin" },
      });
      expect((await call(request)).status).toBe(403);
      expect(ensureSampleSeed).not.toHaveBeenCalled();
      expect(getRender).not.toHaveBeenCalled();
      expect(approveEditorRender).not.toHaveBeenCalled();
      expect(getEditorVoiceJob).not.toHaveBeenCalled();
      expect(getAssetStore).not.toHaveBeenCalled();
    },
  );

  it.each(endpoints)(
    "$name rejects forged browser signals in strict mode",
    async ({ call }) => {
      vi.stubEnv("REEL_STRICT_AUTH", "1");
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: { host: "localhost:3000", "sec-fetch-site": "same-origin" },
      });
      expect((await call(request)).status).toBe(401);
    },
  );

  it("allows the default local project list", async () => {
    vi.stubEnv("REEL_STRICT_AUTH", "");
    const response = await projects(
      new Request("http://localhost:3000/api/projects", {
        headers: { host: "localhost:3000" },
      }),
    );
    expect(response.status).toBe(200);
    expect(ensureSampleSeed).toHaveBeenCalledOnce();
  });

  it("never lets bearer automation approve a render", async () => {
    vi.stubEnv("MCP_API_TOKEN", "test-automation-token");
    const response = await approve(
      new Request("http://localhost:3000/api/test", {
        headers: {
          host: "localhost:3000",
          authorization: "Bearer test-automation-token",
        },
      }),
      { params: Promise.resolve({ id: "test" }) },
    );
    expect(response.status).toBe(403);
    expect(approveEditorRender).not.toHaveBeenCalled();
  });

  it("Proxy blocks DNS rebinding on pages too", () => {
    vi.stubEnv("REEL_ALLOWED_HOSTS", "");
    expect(
      proxy(
        new NextRequest("http://localhost:3000/", {
          headers: { host: "evil.example" },
        }),
      ).status,
    ).toBe(403);
    expect(
      proxy(
        new NextRequest("http://localhost:3000/", {
          headers: { host: "localhost:3000" },
        }),
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });
});
