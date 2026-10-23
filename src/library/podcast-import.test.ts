// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAudioWav } from "@/lib/audio-edit-plan";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/library/db", () => ({
  prisma: { podcast: { findUnique: mocks.find } },
}));
vi.mock("@/library/storage", () => ({
  getAssetStore: () => ({ put: mocks.put, delete: mocks.remove }),
}));
vi.mock("@/library/repositories/podcasts", () => ({
  createPodcastTake: mocks.create,
}));
import { importPodcastAudio } from "./podcast-import";
const wav = () => Buffer.from(encodeAudioWav([new Float32Array(4410)], 44100));
describe("podcast recording imports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.find.mockResolvedValue({ id: "podcast" });
    mocks.put.mockResolvedValue({});
    mocks.remove.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue({ id: "take" });
  });
  it("saves genuine duration without fabricating transcript timing", async () => {
    await expect(importPodcastAudio("podcast", wav())).resolves.toEqual({
      id: "take",
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalFrames: 3,
        timeline: [],
        chapters: [],
        providerId: "recording",
      }),
    );
  });
  it("rejects non-PCM and truncated uploads before writing assets", async () => {
    const encoded = wav();
    encoded.writeUInt16LE(3, 20);
    await expect(importPodcastAudio("podcast", encoded)).rejects.toThrow("PCM");
    await expect(
      importPodcastAudio("podcast", wav().subarray(0, 100)),
    ).rejects.toThrow("PCM");
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("removes orphaned audio when saving the take fails", async () => {
    mocks.create.mockRejectedValue(new Error("Database unavailable"));
    await expect(importPodcastAudio("podcast", wav())).rejects.toThrow(
      "Database unavailable",
    );
    expect(mocks.remove).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
  });
  it("does not save a recording for a missing episode", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(importPodcastAudio("gone", wav())).rejects.toThrow(
      "not found",
    );
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
