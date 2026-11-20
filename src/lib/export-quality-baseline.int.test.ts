import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("measures an encoded export and distinguishes hard cuts from annotated scenes", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-quality-baseline-"));
  try {
    const video = path.join(directory, "two-shots.mp4");
    const transcript = path.join(directory, "narration.txt");
    const annotations = path.join(directory, "annotations.json");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "color=black:s=160x90:r=30:d=1",
      "-f",
      "lavfi",
      "-i",
      "color=white:s=160x90:r=30:d=1",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=2",
      "-filter_complex",
      "[0:v][1:v]concat=n=2:v=1:a=0[video]",
      "-map",
      "[video]",
      "-map",
      "2:a",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-threads:v",
      "1",
      video,
    ]);
    writeFileSync(transcript, "One two three four.");
    writeFileSync(
      annotations,
      JSON.stringify({
        [video]: { transcript, sceneBoundariesSeconds: [0.75] },
      }),
    );
    const output = execFileSync(
      process.execPath,
      ["scripts/measure-exports.mjs", "--annotations", annotations, video],
      { encoding: "utf8" },
    );
    const report = JSON.parse(output);
    const measured = report.exports[0];
    expect(measured.durationSeconds).toBe(2);
    expect(measured.audio.integratedLufs).toBeGreaterThan(-100);
    expect(measured.audio.truePeakDbtp).toBeLessThan(0);
    expect(measured.pacing.hardCutTimesSeconds).toEqual([1]);
    expect(measured.pacing.hardCutsPerMinute).toBe(30);
    expect(measured.pacing.annotatedScenes.sceneLengthSeconds).toMatchObject({
      min: 0.75,
      max: 1.25,
    });
    expect(measured.narration).toEqual({
      source: "transcript",
      words: 4,
      wordsPerVideoMinute: 120,
    });
    expect(measured.typography).toBeNull();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
