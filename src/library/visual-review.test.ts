// @vitest-environment node
import { promises as fs } from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  layoutIssue: "" as string,
  spawn: vi.fn(),
  wrongFrame: false,
  missingEvidence: false,
  files: new Map<string, Buffer>(),
}));
vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof import("node:child_process")>()),
  spawn: mocks.spawn,
}));
vi.mock("@/library/video-snapshot", () => ({
  captureVideoSnapshot: mocks.capture,
}));

vi.mock("@/library/storage", () => ({
  getAssetStore: () => ({
    exists: async (key: string) => mocks.files.has(key),
    get: async (key: string) => {
      const value = mocks.files.get(key);
      if (!value) throw new Error("Missing");
      return value;
    },
    put: async (key: string, value: Buffer) => {
      mocks.files.set(key, value);
      return { key };
    },
    url: (key: string) => `/media/${key}`,
  }),
}));
vi.mock("@/library/video-stage-media", async (original) => ({
  ...(await original<typeof import("@/library/video-stage-media")>()),
  resolveVideoStageMedia: async (snapshot: unknown) => ({
    snapshot,
    assets: [],
  }),
}));
vi.mock("@/library/visual-review-contrast", () => ({
  reviewPixelContrast: async (_file: string, evidence: unknown) => evidence,
}));
import { createVisualReview } from "./visual-review";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { serverDefaultTokens } from "@/lib/brand-defaults";
const snapshot = videoSnapshotSchema.parse({
  version: 1,
  take: null,
  script: {
    id: "script",
    projectId: "project",
    name: "Review",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "hyperframes",
    scenes: [
      {
        id: "scene",
        scriptId: "script",
        order: 0,
        templateId: "hook",
        text: "A clear idea",
        spokenText: null,
        emphasis: [],
        hideText: null,
        selectedVoiceClipId: null,
        motion: { recipeId: "type-impact", version: "1.0.0" },
      },
    ],
    brandTokens: serverDefaultTokens,
    coverUrl: null,
    musicUrl: null,
    musicVolume: 20,
    sfxEnabled: false,
    sfxJson: null,
    hideText: false,
    hideProgressBar: false,
    styleId: "bold-hook",
    energy: "normal",
    productionPreset: { id: "creator-punch", version: "1.0.0" },
  },
});
const input = { sceneIds: ["scene"], samples: 1 as const };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.files.clear();
  mocks.wrongFrame = false;
  mocks.missingEvidence = false;
  mocks.layoutIssue = "";
  mocks.spawn.mockImplementation((_binary, args, options) => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });
    queueMicrotask(async () => {
      const config = options.env.REEL_REVIEW_CAPTURE_CONFIG
        ? JSON.parse(
            await fs.readFile(options.env.REEL_REVIEW_CAPTURE_CONFIG, "utf8"),
          )
        : null;
      const output = args[args.indexOf("--output") + 1];
      await fs.writeFile(
        path.join(output, "frame-00-at-1.000s.png"),
        "native HyperFrames still",
      );
      if (config)
        await fs.writeFile(
          config.output,
          JSON.stringify(
            config.frames.map((frame: number) => ({
              frame:
                frame + (mocks.wrongFrame || mocks.missingEvidence ? 1 : 0),
              checkedTextNodes: 1,
              truncated: false,
              contrastCheckedTextNodes: 1,
              issues: mocks.layoutIssue
                ? [
                    {
                      kind: mocks.layoutIssue,
                      text: "A clear idea",
                      contrastRatio: 1.2,
                      bounds: { left: 100, top: 200, right: 700, bottom: 300 },
                    },
                  ]
                : [],
            })),
          ),
        );
      child.emit("close", 0);
    });
    return child;
  });
  mocks.capture.mockImplementation(async () => structuredClone(snapshot));
});
describe("cached visual review", () => {
  it("reads a retired revision without rewriting its immutable provenance", () => {
    const legacy = {
      ...structuredClone(snapshot),
      script: { ...structuredClone(snapshot.script), videoEngine: "remotion" },
    };
    const original = JSON.stringify(legacy);
    const parsed = videoSnapshotSchema.parse(legacy);
    expect(parsed.script.videoEngine).toBe("hyperframes");
    expect(parsed.script.scenes).toEqual(snapshot.script.scenes);
    expect(JSON.stringify(legacy)).toBe(original);
  });

  it("cancels queued requests without reading or rendering a video", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createVisualReview(
        "script",
        input,
        "http://localhost:3000",
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.spawn).toHaveBeenCalledOnce();
  });
  it("caches exact frames, preserves direction and repairs a removed cache file", async () => {
    const first = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(first.stills).toHaveLength(1);
    expect(first.takeUsable).toBe(false);
    expect(mocks.spawn).toHaveBeenCalledOnce();
    expect(
      await createVisualReview("script", input, "http://localhost:3000"),
    ).toEqual(first);
    expect(mocks.spawn).toHaveBeenCalledOnce();
    mocks.files.clear();
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
  });
  it("invalidates stills after visual edits and rejects removed scenes before capture", async () => {
    const first = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    const edited = structuredClone(snapshot);
    edited.script.scenes[0].text = "Another idea";
    mocks.capture.mockResolvedValue(edited);
    const second = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(second.revision).not.toBe(first.revision);
    expect(second.stills[0].url).not.toBe(first.stills[0].url);
    await expect(
      createVisualReview(
        "script",
        { sceneIds: ["removed"], samples: 1 },
        "http://localhost:3000",
      ),
    ).rejects.toThrow("no longer exists");
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
  });
  it("returns advisory findings from the same saved scene and estimated timing as its stills", async () => {
    const edited = structuredClone(snapshot);
    edited.script.scenes[0].text = "a".repeat(121);
    edited.script.scenes[0].spokenText = "Short narration";
    mocks.capture.mockResolvedValue(edited);
    const result = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(result.findings.map((finding) => finding.kind)).toEqual([
      "fallback",
      "reading-time",
    ]);
    expect(
      result.findings.every(
        (finding) => finding.sceneId === "scene" && finding.frame === 0,
      ),
    ).toBe(true);
    edited.script.hideText = true;
    mocks.capture.mockResolvedValue(edited);
    expect(
      (await createVisualReview("script", input, "http://localhost:3000"))
        .findings,
    ).toEqual([]);
  });
  it("caches native layout evidence and repairs corrupt evidence with the same still", async () => {
    const edited = structuredClone(snapshot);
    edited.script.scenes[0].spokenText =
      "This narration gives the text a clear and sufficiently long reading hold";
    mocks.capture.mockResolvedValue(edited);
    mocks.layoutIssue = "text-clipping";
    const first = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(first.layoutReview?.status).toBe("sampled");
    expect(
      first.findings.some(
        (finding) =>
          finding.kind === "text-clipping" &&
          finding.frame === first.stills[0].frame,
      ),
    ).toBe(true);
    expect(
      await createVisualReview("script", input, "http://localhost:3000"),
    ).toEqual(first);
    expect(mocks.spawn).toHaveBeenCalledOnce();
    const key = [...mocks.files.keys()].find((key) =>
      key.endsWith(".layout.json"),
    )!;
    mocks.files.set(key, Buffer.from("broken evidence"));
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
  });
  it("captures and caches HyperFrames evidence at the same native screenshot point", async () => {
    mocks.layoutIssue = "contrast";
    const edited = structuredClone(snapshot);
    edited.script.videoEngine = "hyperframes";
    edited.script.scenes[0].spokenText =
      "This narration gives the text a clear and sufficiently long reading hold";
    mocks.capture.mockResolvedValue(edited);
    const first = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(first.layoutReview).toMatchObject({
      status: "sampled",
      contrastCheckedTextNodes: 1,
    });
    expect(first.stills[0].layout?.frame).toBe(first.stills[0].frame);
    expect(
      first.findings.some(
        (value) => value.kind === "contrast" && value.message.includes("1.2:1"),
      ),
    ).toBe(true);
    expect(mocks.spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        "--import",
        "tsx",
        "snapshot",
        "--describe",
        "false",
      ]),
      expect.any(Object),
    );
    expect(
      await createVisualReview("script", input, "http://localhost:3000"),
    ).toEqual(first);
    expect(mocks.spawn).toHaveBeenCalledOnce();
  });
  it("rejects HyperFrames evidence that disagrees with its captured frame", async () => {
    const edited = structuredClone(snapshot);
    edited.script.videoEngine = "hyperframes";
    edited.script.scenes[0].spokenText =
      "This narration gives the text a clear and sufficiently long reading hold";
    mocks.capture.mockResolvedValue(edited);
    mocks.wrongFrame = true;
    await expect(
      createVisualReview("script", input, "http://localhost:3000"),
    ).rejects.toThrow("did not match captured frames");
    expect(mocks.files.size).toBe(0);
  });
  it("rejects unmatched native measurements before publishing a reading still", async () => {
    const edited = structuredClone(snapshot);
    edited.script.scenes[0].spokenText =
      "This narration gives the text a clear and sufficiently long reading hold";
    mocks.capture.mockResolvedValue(edited);
    mocks.missingEvidence = true;
    await expect(
      createVisualReview("script", input, "http://localhost:3000"),
    ).rejects.toThrow("measurement did not match captured frames");
    expect(mocks.files.size).toBe(0);
  });
  it("does not publish a failed capture and retries successfully", async () => {
    mocks.spawn.mockImplementationOnce(() => {
      throw new Error("Media unavailable");
    });
    await expect(
      createVisualReview("script", input, "http://localhost:3000"),
    ).rejects.toThrow("Media unavailable");
    expect(mocks.files.size).toBe(0);
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.files.size).toBe(1);
  });
});
