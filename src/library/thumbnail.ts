import puppeteer from "puppeteer";
import { extractVideoFrame } from "@/library/video-frame";

import {
  buildThumbnailHtml,
  THUMBNAIL_SIZES,
  type ThumbnailPalette,
  type ThumbnailSize,
} from "@/lib/thumbnail-html";

/** One frame of the video as a JPEG data URL, or undefined when it cannot be read. */
export async function frameDataUrl(
  videoPath: string,
  atSeconds = 1,
): Promise<string | undefined> {
  const frame = await extractVideoFrame(videoPath, atSeconds, "scale=1280:-2");
  return frame
    ? `data:image/jpeg;base64,${frame.toString("base64")}`
    : undefined;
}

type ThumbnailInput = {
  text: string;
  palette?: Partial<ThumbnailPalette>;
  fontFamily?: string;
  videoPath?: string;
};

/** Reuse the same frame and Chrome session for the requested sizes. */
export async function renderThumbnailPngs(
  input: ThumbnailInput,
  sizes: readonly ThumbnailSize[],
): Promise<Buffer[]> {
  const frame = input.videoPath
    ? await frameDataUrl(input.videoPath)
    : undefined;
  const browser = await puppeteer.launch({
    executablePath:
      process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const outputs: Buffer[] = [];
    for (const size of sizes) {
      await page.setViewport(THUMBNAIL_SIZES[size]);
      await page.setContent(
        buildThumbnailHtml({ ...input, size, frameDataUrl: frame }),
        { waitUntil: "load" },
      );
      await page.evaluate(() => {
        const words = document.querySelector<HTMLElement>(".words");
        if (!words) return;
        let font = Number.parseFloat(getComputedStyle(words).fontSize);
        while (words.scrollHeight > words.clientHeight && font > 24) {
          font -= 2;
          words.style.fontSize = `${font}px`;
        }
      });
      outputs.push(Buffer.from(await page.screenshot({ type: "png" })));
    }
    return outputs;
  } finally {
    await browser.close();
  }
}

/** Turn a single thumbnail into a PNG with the studio's local Chrome. */
export async function renderThumbnailPng(
  input: ThumbnailInput & { size: ThumbnailSize },
): Promise<Buffer> {
  const [thumbnail] = await renderThumbnailPngs(input, [input.size]);
  return thumbnail!;
}
