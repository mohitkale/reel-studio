import { describe, expect, it } from "vitest";

import { gridStepSeconds } from "@/lib/beat-sync";
import { stitchBeats } from "@/lib/audio-timing";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { makeSilentWav } from "@/lib/wav";
import { beatSyncedGaps } from "@/library/take-service";

const track = MUSIC_LIBRARY[0]!;
const beats = [2.7, 3.1, 2.2, 4.05].map((seconds, i) => ({
  sceneId: `s${i}`,
  text: "x",
  wav: makeSilentWav(seconds),
}));

describe("beatSyncedGaps", () => {
  it("keeps the usual gap when the music is not a bundled track", () => {
    expect(beatSyncedGaps(beats, { musicUrl: "/media/mine.mp3" })).toBe(0.45);
    expect(beatSyncedGaps(beats, { musicUrl: null })).toBe(0.45);
  });

  it("starts every later scene on a beat of the music", () => {
    const gaps = beatSyncedGaps(beats, { musicUrl: track.url });
    expect(Array.isArray(gaps)).toBe(true);
    const stitched = stitchBeats(beats, 30, gaps);
    const interval = gridStepSeconds(track);
    for (const entry of stitched.timeline.slice(1)) {
      const at = entry.startFrame / 30;
      const phase = ((at - track.offsetSeconds) / interval) % 1;
      const off = Math.min(phase, 1 - phase) * interval;
      // Within a frame of a beat (frames round to 1/30 s).
      expect(off).toBeLessThan(1 / 30 + 0.001);
    }
  });

  it("shifts the grid by the cover hold when a cover is shown", () => {
    // A 75 bpm track (landing every 0.4 s): the 1.5 s cover is not a whole number of steps.
    const slow = MUSIC_LIBRARY.find((t) => t.bpm === 75)!;
    const plain = beatSyncedGaps(beats, { musicUrl: slow.url }) as number[];
    const covered = beatSyncedGaps(beats, {
      musicUrl: slow.url,
      coverUrl: "/media/cover.png",
    }) as number[];
    expect(covered).not.toEqual(plain);
  });
});
