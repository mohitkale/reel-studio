import { describe, expect, it } from "vitest";

import { makeSilentWav, parseWav, pcmToWav } from "@/lib/wav";
import {
  applyPodcastPronunciations,
  assemblePodcastMaster,
} from "@/library/podcast-finishing";

function tone(seconds: number): Buffer {
  const samples = Math.round(44_100 * seconds);
  const pcm = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    pcm.writeInt16LE(Math.round(Math.sin(index / 20) * 12_000), index * 2);
  }
  return pcmToWav(pcm);
}

describe("podcast finishing", () => {
  it("applies ordered case-aware pronunciations without changing source text", () => {
    const source = "Read the SQL API and sql guide.";
    expect(
      applyPodcastPronunciations(source, [
        { find: "SQL", replaceWith: "sequel", caseSensitive: true },
        { find: "API", replaceWith: "A P I", caseSensitive: false },
      ]),
    ).toBe("Read the sequel A P I and sql guide.");
    expect(source).toBe("Read the SQL API and sql guide.");
  });

  it("changes only matching turn speech so unrelated cache inputs stay stable", () => {
    const rules = [
      {
        find: "Reel Studio",
        replaceWith: "Reel Stew-dee-oh",
        caseSensitive: false,
      },
    ];
    expect(applyPodcastPronunciations("Welcome to Reel Studio", rules)).toBe(
      "Welcome to Reel Stew-dee-oh",
    );
    expect(
      applyPodcastPronunciations("This turn remains reusable", rules),
    ).toBe("This turn remains reusable");
  });

  it("adds bounded faded bumpers and reports the exact timeline shift", () => {
    const speech = makeSilentWav(2);
    const result = assemblePodcastMaster({
      speechWav: speech,
      introWav: tone(1),
      outroWav: tone(1.5),
      fps: 30,
    });
    expect(result.introFrames).toBe(30);
    expect(result.outroFrames).toBe(45);
    expect(parseWav(result.wav).durationSeconds).toBeCloseTo(4.5, 3);
  });
});
