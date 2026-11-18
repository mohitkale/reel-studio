import { execFile } from "node:child_process";
import { promisify } from "node:util";

import puppeteer from "puppeteer";

import {
  buildThumbnailHtml,
  THUMBNAIL_SIZES,
  type ThumbnailPalette,
  type ThumbnailSize,
} from "@/lib/thumbnail-html";

const run = promisify(execFile);

/** One frame of the video as a JPEG data URL, or undefined when it cannot be read. */
export async function frameDataUrl(
  videoPath: string,
  atSeconds = 1,
): Promise<string | undefined> {
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
        "scale=1280:-2",
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
    return stdout.length > 0
      ? `data:image/jpeg;base64,${stdout.toString("base64")}`
      : undefined;
  } catch {
    return undefined;
  }
}

/** Turn the thumbnail page into a PNG with the Chrome the studio already needs for exports. */
export async function renderThumbnailPng(input: {
  text: string;
  size: ThumbnailSize;
  palette?: Partial<ThumbnailPalette>;
  fontFamily?: string;
  videoPath?: string;
}): Promise<Buffer> {
  const { width, height } = THUMBNAIL_SIZES[input.size];
  const html = buildThumbnailHtml({
    text: input.text,
    size: input.size,
    palette: input.palette,
    fontFamily: input.fontFamily,
    frameDataUrl: input.videoPath
      ? await frameDataUrl(input.videoPath)
      : undefined,
  });
  const browser = await puppeteer.launch({
    executablePath:
      process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: "load" });
    return Buffer.from(await page.screenshot({ type: "png" }));
  } finally {
    await browser.close();
  }
}
