import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { downloadMp4, expectPlayableVideo } from "./helpers";

const storyboard = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "e2e", "fixtures", "written.storyboard.json"),
    "utf8",
  ),
) as { title: string };

// Journey 3: no key. Copy the prompt, paste a reply, check it, make and export the video.
test("paste a reply, make the video, export it", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.locator("#one-prompt-input").fill("Why the sky is blue");
  await page.getByText("More options").click();
  await page.getByLabel(/Quick draft/).check();
  await page.getByLabel(/Narrate it with the local voice/).uncheck();
  await page.getByLabel("Show captions").uncheck();

  const copyPrompt = page.getByRole("button", { name: "Copy prompt" });
  if (!(await copyPrompt.isVisible()))
    await page.getByText(/Use my own chat assistant/).click();
  await copyPrompt.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Why the sky is blue");

  const reply = `Here you go:\n\`\`\`json\n${JSON.stringify({ ...storyboard, title: "Why the sky is blue, pasted" })}\n\`\`\`\nHope that helps.`;
  await page.locator("#pasted-reply").fill(reply);
  await page.getByRole("button", { name: "Make the video" }).click();

  await page.waitForURL(/\/results\//);
  await expectPlayableVideo(page);
  const videoUrl = await page
    .getByLabel("Finished video")
    .evaluate((element) => (element as HTMLVideoElement).currentSrc);
  const renderName = path.basename(new URL(videoUrl).pathname, ".mp4");
  const folder = path.join(process.cwd(), "media", "exports", renderName);
  const files = readdirSync(folder).sort();
  expect(files).toEqual([
    "captions.srt",
    "captions.vtt",
    "description.txt",
    "hashtags.txt",
    "storyboard.json",
    "thumbnail-1080x1920.png",
    "thumbnail-1280x720.png",
    "title.txt",
    "video.mp4",
  ]);
  const read = (name: string) => readFileSync(path.join(folder, name), "utf8");
  expect(read("title.txt").trim()).toBe("Why the sky is blue, pasted");
  expect(read("description.txt")).toMatch(/^Sunlight looks white,/);
  expect(read("captions.srt")).toBe("");
  expect(read("captions.vtt")).toBe("WEBVTT\n\n");
  for (const [width, height] of [
    [1280, 720],
    [1080, 1920],
  ]) {
    expect(
      await sharp(
        path.join(folder, `thumbnail-${width}x${height}.png`),
      ).metadata(),
    ).toMatchObject({ width, height, format: "png" });
  }
  const jobId = new URL(page.url()).pathname.split("/").at(-1);
  const response = await page.request.post(
    `/api/production-jobs/${jobId}/export-folder`,
  );
  expect(response.ok()).toBe(true);
  const exported = await response.json();
  expect(exported.folder).toBe(folder);
  expect(exported.files.sort()).toEqual(files);
  await downloadMp4(page);

  const poster = `/api/renders/${renderName.slice("render-".length)}/poster`;
  for (const [route, width] of [
    ["/", 1440],
    ["/", 375],
    ["/library", 375],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    const frame = page.locator(`img[src$="${poster}"]`);
    await frame.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect
      .poll(() => frame.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await page.screenshot({
      path: testInfo.outputPath(
        `${route === "/" ? "create" : "library"}-${width}.png`,
      ),
    });
  }
});
