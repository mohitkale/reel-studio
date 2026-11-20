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
  const mode = await page.request.post("/api/ui-mode", {
    data: { mode: "simple", onboarded: true, reviewBeforeMaking: false },
  });
  expect(mode.ok()).toBe(true);
  await page.goto("/");
  const simple = page.getByRole("radio", { name: "Simple", exact: true });
  const pro = page.getByRole("radio", { name: "Pro", exact: true });
  await expect(simple).toHaveAttribute("aria-checked", "true");
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
  const resultPath = new URL(page.url()).pathname;
  const jobId = resultPath.split("/").at(-1);
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(resultPath);
  await expect(simple).toHaveAttribute("aria-checked", "true");
  const editor = page.getByRole("link", { name: "Open full editor" });
  await expect(editor).toBeVisible();
  const editorPath = new URL((await editor.getAttribute("href"))!, page.url())
    .pathname;
  await expectPlayableVideo(page);
  const player = page.getByLabel("Finished video");
  await player.evaluate((video: HTMLVideoElement) => {
    video.currentTime = 1;
  });
  await expect
    .poll(() =>
      player.evaluate(
        (video: HTMLVideoElement) => !video.seeking && video.readyState >= 2,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("simple-project.png") });
  await page
    .locator("aside")
    .screenshot({ path: testInfo.outputPath("simple-sidebar.png") });
  await pro.click();
  await expect(pro).toHaveAttribute("aria-checked", "true");
  const expandSidebar = page.getByRole("button", { name: "Expand sidebar" });
  if (await expandSidebar.isVisible()) await expandSidebar.click();
  await page
    .locator("aside")
    .screenshot({ path: testInfo.outputPath("pro-sidebar.png") });
  await editor.click();
  await page.waitForURL((url) => url.pathname === editorPath);

  const sceneText = page.getByRole("textbox", {
    name: "On-screen text",
    exact: true,
  });
  await expect(sceneText).toHaveValue("Why is the sky blue?");
  const edited = "Why our sky looks blue";
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      /\/api\/scenes\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await sceneText.fill(edited);
  await sceneText.press("Tab");
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Saving…", { exact: true })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("pro-project.png") });

  await page.getByText("Customize video", { exact: true }).click();
  for (const [button, dialog] of [
    ["Film plan JSON", "Film plan checkpoint"],
    ["Chapters", "Chapter structure"],
    ["AI", "Generate scenes with AI"],
    ["Search stock", "Stock media"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page
    .getByText("Editorial review and targeted revisions", { exact: true })
    .click();
  await expect(page.getByLabel("Editorial revision action")).toBeVisible();
  await page.getByText("Create a language version", { exact: true }).click();
  await expect(page.getByPlaceholder("For example, Hindi")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Scene by scene" }),
  ).toBeVisible();

  await simple.click();
  await expect(simple).toHaveAttribute("aria-checked", "true");
  await page
    .locator("aside")
    .getByRole("link", { name: "Create", exact: true })
    .click();
  const recent = page.getByRole("region", { name: "Recent videos" });
  await recent.locator(`a[href$="${editorPath}"]`).click();
  await page.waitForURL((url) => url.pathname === editorPath);
  await expect(simple).toHaveAttribute("aria-checked", "true");
  await expect(sceneText).toHaveValue(edited);
  await page.screenshot({ path: testInfo.outputPath("simple-reopened.png") });
});
