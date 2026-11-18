import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// A podcast storyboard in, a mastered episode out. It needs the local voice
// model, so it is skipped on a machine that does not have it.
test("a podcast storyboard becomes a mastered episode with a package", async ({
  request,
}) => {
  test.setTimeout(10 * 60_000);
  const model = (await (await request.get("/api/voice-model")).json()) as {
    cached: boolean;
  };
  test.skip(!model.cached, "the local voice model is not installed");

  const response = await request.post("/api/storyboards", {
    data: {
      version: 1,
      kind: "podcast",
      title: "Why the sky is blue",
      music: "calm-morning",
      speakers: [
        { id: "host", name: "Maya", voiceId: "af_heart" },
        { id: "guest", name: "Sam", voiceId: "am_michael" },
      ],
      turns: [
        {
          speaker: "host",
          text: "Welcome to the show. Today: why the sky is blue.",
        },
        {
          speaker: "guest",
          text: "Sunlight looks white, but it is every colour mixed together.",
        },
        { speaker: "host", text: "So why does blue win?" },
        {
          speaker: "guest",
          text: "Air scatters short waves far more than long ones, so blue reaches your eyes from everywhere.",
        },
      ],
    },
  });
  expect(response.status()).toBe(202);
  const queued = (await response.json()) as {
    jobId: string;
    podcastId: string;
    kind: string;
  };
  expect(queued.kind).toBe("podcast");

  let take: {
    id: string;
    mp3Path?: string;
    audioUrl: string;
    chapters?: unknown[];
  } | null = null;
  await expect
    .poll(
      async () => {
        const job = (
          await (
            await request.get(
              `/api/podcasts/${queued.podcastId}/takes/${queued.jobId}`,
            )
          ).json()
        ).job as {
          status: string;
          error: string | null;
          podcastTake: typeof take;
        };
        if (job.status === "error")
          throw new Error(job.error ?? "the episode failed");
        take = job.podcastTake;
        return job.status;
      },
      { timeout: 8 * 60_000, intervals: [3000] },
    )
    .toBe("done");

  // The package is a .tar.gz: WAV, MP3, transcript, chapters, show notes and a manifest.
  const bundle = await request.get(`/api/podcast-takes/${take!.id}/bundle`);
  expect(bundle.status()).toBe(200);
  const zip = gunzipSync(await bundle.body()).toString("latin1");
  for (const name of [
    "episode.wav",
    "transcript.txt",
    "chapters.json",
    "show-notes.md",
    "manifest.json",
  ])
    expect(zip, name).toContain(name);

  // The episode is at -16 LUFS, measured by FFmpeg on the delivered WAV.
  const wav = await request.get(take!.audioUrl);
  expect(wav.status()).toBe(200);
  const measured = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-af",
      "ebur128=framelog=quiet",
      "-f",
      "null",
      "-",
    ],
    { input: await wav.body(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const lufs = Number(
    [...measured.stderr.matchAll(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g)].at(-1)?.[1],
  );
  expect(Math.abs(lufs + 16), `${lufs} LUFS`).toBeLessThan(1.5);
});
