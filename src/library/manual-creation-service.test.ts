// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAssets, createProjectFromPlan, ingestPublicArticle } = vi.hoisted(
  () => ({
    getAssets: vi.fn(),
    createProjectFromPlan: vi.fn(),
    ingestPublicArticle: vi.fn(),
  }),
);

vi.mock("@/library/repositories/assets", () => ({ getAssets }));
vi.mock("@/library/repositories/projects", () => ({ createProjectFromPlan }));
vi.mock("@/production/source-ingestion", () => ({ ingestPublicArticle }));

import { createManualProject } from "@/library/manual-creation-service";

describe("manual creation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProjectFromPlan.mockResolvedValue({
      projectId: "project-1",
      scriptId: "script-1",
    });
  });

  it("persists preset, roles, brand, voice mode, and uploaded media", async () => {
    getAssets.mockResolvedValue([
      {
        id: "image-1",
        type: "image",
        name: "dashboard.png",
        url: "/media/assets/images/dashboard.png",
        meta: null,
        createdAt: "2026-09-12T00:00:00.000Z",
      },
    ]);
    const result = await createManualProject({
      name: "Product walkthrough",
      outputType: "video",
      source: {
        kind: "text",
        text: Array.from(
          { length: 8 },
          (_, index) =>
            `Scene ${index + 1} explains a supplied product detail clearly for the viewer.`,
        ).join(" "),
      },
      presetId: "product-launch",
      orientation: "portrait",
      videoEngine: "hyperframes",
      brandKitId: "brand-1",
      voiceMode: "per_scene",
      assetIds: ["image-1"],
    });

    expect(result).toMatchObject({
      projectId: "project-1",
      scriptId: "script-1",
      preset: { id: "product-launch", version: "1.0.0" },
    });
    const call = createProjectFromPlan.mock.calls[0]!;
    expect(call[1]).toBe("portrait");
    expect(call[2].some((background: unknown) => background)).toBe(true);
    expect(call[3]).toBe("hyperframes");
    expect(call[5]).toMatchObject({
      brandKitId: "brand-1",
      preset: { id: "product-launch", version: "1.0.0" },
      voiceMode: "per_scene",
      creationSource: { kind: "text", assetIds: ["image-1"] },
    });
    expect(call[5].roles).toContain("screenshot-demo");
    expect(call[5].assetRefs.flat()).toContain("image-1");
  });

  it("extracts URL content before deterministic planning", async () => {
    getAssets.mockResolvedValue([]);
    ingestPublicArticle.mockResolvedValue({
      url: "https://example.com/final",
      title: "Example article",
      text: "This public article contains enough supplied text to create a deterministic scene.",
    });

    const result = await createManualProject({
      name: "Article reel",
      source: { kind: "url", url: "https://example.com/start" },
      presetId: "editorial-explainer",
      orientation: "square",
      videoEngine: "remotion",
    });

    expect(ingestPublicArticle).toHaveBeenCalledWith(
      "https://example.com/start",
    );
    expect(result.source).toEqual({
      kind: "url",
      url: "https://example.com/final",
      title: "Example article",
    });
    expect(createProjectFromPlan.mock.calls[0]?.[0].scenes[0].text).toContain(
      "public article",
    );
  });

  it("fails rather than silently dropping a missing upload", async () => {
    getAssets.mockResolvedValue([]);
    await expect(
      createManualProject({
        name: "Missing upload",
        source: {
          kind: "text",
          text: "This supplied script contains enough text for a valid production draft.",
        },
        presetId: "creator-punch",
        orientation: "landscape",
        videoEngine: "hyperframes",
        assetIds: ["missing"],
      }),
    ).rejects.toThrow(/no longer exist/i);
    expect(createProjectFromPlan).not.toHaveBeenCalled();
  });
});
