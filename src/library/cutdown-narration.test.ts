import { beforeEach, describe, expect, it, vi } from "vitest";
import { reuseCutdownNarration } from "./cutdown-narration";
import { getCachedBeatAudio, setCachedBeatWav } from "./scene-audio-cache";

vi.mock("./scene-audio-cache", async (load) => ({
  ...(await load<typeof import("./scene-audio-cache")>()),
  getCachedBeatAudio: vi.fn(),
  setCachedBeatWav: vi.fn(),
}));

const wav = Buffer.from("cached audio");
const words = [{ text: "Same", startSeconds: 0, endSeconds: 0.2 }];
const voice = {
  enabled: true,
  providerId: "kokoro-server" as const,
  voiceId: "af_heart",
  modelId: "model",
  speed: 0.9,
  style: "calm" as const,
  paces: [0.88, 1, 1, 1],
};
const input = {
  source: [
    { id: "s1", text: "Original headline", spokenText: "Same narration." },
    { id: "s2", text: "Original hook" },
    { id: "s3", text: "No cached take" },
  ],
  target: {
    id: "short",
    scenes: [
      { id: "d1", text: "New headline", spokenText: "Same narration." },
      { id: "d2", text: "Rewritten hook" },
      { id: "d3", text: "No cached take" },
      { id: "d4", text: "New closing" },
    ],
  },
  sourceSceneIndices: [0, 1, 2, null],
  voice,
};

beforeEach(() => vi.resetAllMocks());

describe("reuseCutdownNarration", () => {
  it("copies matching WAVs and word timings with the original synthesis key", async () => {
    vi.mocked(getCachedBeatAudio)
      .mockResolvedValueOnce({ wav, words })
      .mockResolvedValueOnce(null);
    await reuseCutdownNarration(input);
    const key = {
      sceneId: "s1",
      providerId: "kokoro-server",
      voiceId: "af_heart",
      modelId: "model",
      text: "Same narration.\0speed=0.9\0style=calm\0pace=0.88",
    };
    expect(getCachedBeatAudio).toHaveBeenCalledWith(key);
    expect(getCachedBeatAudio).toHaveBeenCalledTimes(2);
    expect(setCachedBeatWav).toHaveBeenCalledExactlyOnceWith(
      { ...key, sceneId: "d1", scriptId: "short" },
      wav,
      words,
    );
  });

  it("leaves a silent short alone", async () => {
    await reuseCutdownNarration({
      ...input,
      voice: { ...voice, enabled: false },
    });
    expect(getCachedBeatAudio).not.toHaveBeenCalled();
    expect(setCachedBeatWav).not.toHaveBeenCalled();
  });
});
