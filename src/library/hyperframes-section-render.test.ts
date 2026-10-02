// @vitest-environment node
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it, vi } from "vitest";
import type { PlanV2Manifest, PlanV2Result } from "@hyperframes/producer";
vi.mock("@/library/render-section-cache", async (original) => ({
  ...(await original<typeof import("@/library/render-section-cache")>()),
  renderCachedSection: vi.fn(
    async (input: {
      render: (file: string) => Promise<void>;
      section: { index: number };
    }) => {
      const filename = `section-${input.section.index}.mp4`;
      await input.render(filename);
      return { filename, reused: false };
    },
  ),
}));
import { renderHyperframesSections } from "../../scripts/hyperframes-section-render";
it("renders the scoped native plan for each cache key but assembles once with the original complete audio plan", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "reel-native-scope-"));
  const projectDir = path.join(root, "project");
  const visualRoot = path.join(`${projectDir}-sections`, "visuals");
  await fs.mkdir(visualRoot, { recursive: true });
  await fs.writeFile(
    path.join(visualRoot, "manifest.json"),
    JSON.stringify({ version: 1, totalFrames: 960, fps: 30, count: 2 }),
  );
  const base = {
    totalFrames: 960,
    chunkCount: 2,
    width: 720,
    height: 1280,
    fps: 30,
  };
  const manifest = {
    ...base,
    protocol: {},
    producerVersion: "0.8.40",
    ffmpegVersion: "test",
    format: "mp4",
    limitations: { videoDependencyMode: "exact-rendered-frames" },
    artifacts: [
      {
        path: "meta/encoder.json",
        sha256: "encoder",
        sizeBytes: 1,
        chunks: "all",
        assembler: true,
      },
    ],
  } as unknown as PlanV2Manifest;
  const producer = {
    planV2: vi.fn(async () => base as PlanV2Result),
    readPlanV2Manifest: vi.fn(() => manifest),
    renderChunkV2: vi.fn(async (_dir: string, index: number) => ({
      framesEncoded: index === 0 ? 900 : 60,
    })),
    assembleV2: vi.fn(async () => ({})),
  };
  const input = {
    projectDir,
    outputPath: path.join(root, "out.mp4"),
    quality: "draft",
    ...base,
    signal: new AbortController().signal,
  };
  try {
    await renderHyperframesSections(
      input,
      producer as unknown as Parameters<typeof renderHyperframesSections>[1],
    );
    expect(producer.planV2.mock.calls).toHaveLength(3);
    const renderCalls = producer.renderChunkV2.mock.calls;
    expect(renderCalls[0][0]).toContain("visual-plan-0");
    expect(renderCalls[1][0]).toContain("visual-plan-1");
    expect(producer.assembleV2.mock.calls).toHaveLength(1);
    expect(producer.assembleV2).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]plan$/),
      ["section-0.mp4", "section-1.mp4"],
      input.outputPath,
      expect.any(Object),
    );
    producer.planV2
      .mockResolvedValueOnce(base as PlanV2Result)
      .mockResolvedValueOnce({ ...base, totalFrames: 900 } as PlanV2Result);
    await expect(
      renderHyperframesSections(
        input,
        producer as unknown as Parameters<typeof renderHyperframesSections>[1],
      ),
    ).rejects.toThrow("changed global coverage");
    await fs.writeFile(path.join(visualRoot, "manifest.json"), "{}");
    await expect(
      renderHyperframesSections(
        input,
        producer as unknown as Parameters<typeof renderHyperframesSections>[1],
      ),
    ).rejects.toThrow();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
