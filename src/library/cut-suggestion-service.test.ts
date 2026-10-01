// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  verify: vi.fn(),
  suggest: vi.fn(),
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript: mocks.get }));
vi.mock("@/library/music-map-service", () => ({
  verifyMusicMapSource: mocks.verify,
}));
vi.mock("@/production/cut-suggestions", () => ({
  suggestNarrationCuts: mocks.suggest,
}));
import { proposeNarrationCuts } from "./cut-suggestion-service";
import type { MusicMap } from "@/production/music-map";
const map = {
  sourceUrl: "/music/a.wav",
  sourceHash: "a".repeat(64),
} as MusicMap;
const input = {
  takeId: "take",
  reviewed: true as const,
  expectedMusicMap: map,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({
    musicUrl: map.sourceUrl,
    musicMap: map,
    takes: [{ id: "take" }],
  });
  mocks.verify.mockResolvedValue(undefined);
});
it("rejects stale maps, wrong takes and changed local audio before proposing", async () => {
  await expect(
    proposeNarrationCuts(
      "s",
      { ...input, expectedMusicMap: { ...map, bpm: 180 } },
      "http://localhost",
    ),
  ).rejects.toThrow("Music changed");
  expect(mocks.verify).not.toHaveBeenCalled();
  await expect(
    proposeNarrationCuts(
      "s",
      { ...input, takeId: "other" },
      "http://localhost",
    ),
  ).rejects.toThrow("does not belong");
  mocks.verify.mockRejectedValue(new Error("audio changed"));
  await expect(
    proposeNarrationCuts("s", input, "http://localhost"),
  ).rejects.toThrow("audio changed");
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it("verifies the local fingerprint and returns suggestions without a write", async () => {
  mocks.suggest.mockReturnValue({ suggestions: [] });
  await expect(
    proposeNarrationCuts("s", input, "http://localhost"),
  ).resolves.toEqual({ suggestions: [] });
  expect(mocks.verify).toHaveBeenCalledWith(map, "http://localhost");
});
