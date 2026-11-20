import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Extract a JPEG from a local video with the installed FFmpeg. */
export async function extractVideoFrame(
  videoPath: string,
  atSeconds: number,
  scale: string,
): Promise<Buffer | undefined> {
  try {
    const { stdout } = await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-ss",
        atSeconds.toFixed(2),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-vf",
        scale,
        "-q:v",
        "3",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, timeout: 30_000 },
    );
    return stdout.length > 0 ? stdout : undefined;
  } catch {
    return undefined;
  }
}
