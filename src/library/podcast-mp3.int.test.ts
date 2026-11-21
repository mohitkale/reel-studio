// @vitest-environment node
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

import { makeSilentWav } from "@/lib/wav";
import { encodePodcastMp3 } from "./podcast-mp3";

it("embeds the episode title, timed chapters, and front cover in the MP3", async () => {
  const title = "Café Sessions #1; day = Friday";
  const chapters = [
    {
      id: "first",
      title: "Opening #1",
      startFrame: 0,
      endFrame: 45,
      startTurnId: "one",
      endTurnId: "one",
    },
    {
      id: "second",
      title: "Why A=B; the next step",
      startFrame: 45,
      endFrame: 90,
      startTurnId: "two",
      endTurnId: "two",
    },
  ];
  const mp3 = await encodePodcastMp3(makeSilentWav(3), {
    title,
    fps: 30,
    chapters,
  });
  const directory = await fs.mkdtemp(
    path.join(tmpdir(), "reel-test-podcast-mp3-"),
  );
  try {
    const filename = path.join(directory, "episode.mp3");
    await fs.writeFile(filename, mp3);
    const stdout = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_chapters",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        filename,
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(stdout)).toMatchObject({
      format: { tags: { title } },
      chapters: [
        { start: 0, end: 1500, tags: { title: chapters[0].title } },
        { start: 1500, end: 3000, tags: { title: chapters[1].title } },
      ],
      streams: [
        { codec_type: "audio", codec_name: "mp3" },
        {
          codec_type: "video",
          width: 600,
          height: 600,
          disposition: { attached_pic: 1 },
        },
      ],
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
