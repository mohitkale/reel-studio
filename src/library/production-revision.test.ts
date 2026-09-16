import { describe, expect, it } from "vitest";

import { serverDefaultTokens } from "@/lib/brand-defaults";
import { videoRevisionHash } from "@/library/production-revision";
import { videoSnapshotSchema } from "@/production/video-snapshot";

const snapshot = videoSnapshotSchema.parse({
  version: 1,
  stockMedia: [],
  take: null,
  script: {
    id: "script",
    projectId: "project",
    name: "Immutable",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "hyperframes",
    scenes: [
      {
        id: "scene",
        scriptId: "script",
        order: 0,
        templateId: "hf-statement",
        text: "Original text",
        spokenText: null,
        emphasis: [],
        hideText: null,
        selectedVoiceClipId: null,
      },
    ],
    brandTokens: serverDefaultTokens,
    coverUrl: null,
    musicUrl: null,
    musicVolume: 20,
    sfxEnabled: true,
    sfxJson: null,
    hideText: false,
    hideProgressBar: false,
    styleId: "clean-story",
    energy: "normal",
  },
});

describe("production revisions", () => {
  it("hashes identical snapshots deterministically and detects edits", () => {
    expect(videoRevisionHash(structuredClone(snapshot))).toBe(
      videoRevisionHash(snapshot),
    );
    const edited = structuredClone(snapshot);
    edited.script.scenes[0]!.text = "Edited later";
    expect(videoRevisionHash(edited)).not.toBe(videoRevisionHash(snapshot));
  });
});
