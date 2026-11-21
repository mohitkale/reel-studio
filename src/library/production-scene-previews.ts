import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import sharp from "sharp";

import { getAssetStore } from "@/library/storage";
import { renderVisualReviewFrames } from "@/library/visual-review";
import { coverFrames, type ReelProps } from "@/video/types";

/** Save each rendered still as soon as its PNG is complete. */
export async function publishScenePreviews(input: {
  jobId: string;
  props: ReelProps & { fps: number };
  totalFrames: number;
  serverBaseUrl: string;
  signal: AbortSignal;
  publish: (path: string, sceneId: string) => Promise<unknown>;
}) {
  const { props, signal } = input;
  const cover = coverFrames(props.fps, Boolean(props.coverUrl));
  const beats = props.timeline.filter((beat) => beat.durationFrames > 0);
  if (!beats.length || signal.aborted) return;
  const frames = beats.map(
    (beat) => cover + beat.startFrame + Math.floor(beat.durationFrames * 0.4),
  );
  const directory = await fs.mkdtemp(
    path.join(tmpdir(), "reel-scene-previews-"),
  );
  const written = new Set<number>();
  const store = getAssetStore();
  async function publishCompleted() {
    if (signal.aborted) return;
    const files = await fs.readdir(directory);
    for (const file of files) {
      const match = /^frame-(\d+)-at-.*\.png$/.exec(file);
      if (!match || signal.aborted) continue;
      const index = Number(match[1]);
      const beat = beats[index];
      if (!beat || written.has(index)) continue;
      // The capture process can still be writing this frame. Try it again on the next tick.
      const jpg = await sharp(path.join(directory, file))
        .jpeg({ quality: 80 })
        .toBuffer()
        .catch(() => undefined);
      if (!jpg || signal.aborted) continue;
      const key = `production-previews/${input.jobId}/scene-${index}.jpg`;
      await store.put(key, jpg);
      await input.publish(key, beat.sceneId);
      written.add(index);
    }
  }

  let capturing = true;
  const capture = renderVisualReviewFrames(
    "hyperframes",
    props,
    input.totalFrames,
    frames,
    directory,
    input.serverBaseUrl,
    signal,
    undefined,
    0.3,
  )
    .catch(() => [])
    .finally(() => {
      capturing = false;
    });
  try {
    while (capturing && !signal.aborted) {
      await publishCompleted();
      await wait(300, undefined, { signal }).catch(() => {});
    }
    await capture;
    await publishCompleted();
  } finally {
    await capture;
    await fs.rm(directory, { recursive: true, force: true });
  }
}
