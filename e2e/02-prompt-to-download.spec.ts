import { expect, test } from "@playwright/test";

import {
  downloadMp4,
  expectPlayableVideo,
  tabTo,
  useFakeWriter,
} from "./helpers";

// Journey 2: prompt, generation view, result, change the look, download. The
// way in is keyboard only, and every stop shows a visible focus indicator.
test("prompt to a changed, downloaded video by keyboard", async ({ page }) => {
  await useFakeWriter(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What do you want to make?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();

  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await tabTo(page, (f) => f.label === "one-prompt-input");
  await page.keyboard.type("Why the sky is blue");

  // More options: open with the keyboard and choose the quick draft.
  await tabTo(page, (f) => f.label === "More options");
  await page.keyboard.press("Enter");
  await tabTo(page, (f) => f.label === "quick-draft");
  await page.keyboard.press("Space");
  await expect(page.getByLabel(/Quick draft/)).toBeChecked();

  await tabTo(page, (f) => f.tag === "button" && f.label === "Create");
  await page.keyboard.press("Enter");

  // Generation view: steps and scenes show while the video is made.
  await page.waitForURL(/\/results\//);
  await expect(
    page.getByText(/Making your video|Ready to download/),
  ).toBeVisible();
  await expectPlayableVideo(page);
  await expect(page.getByRole("heading", { name: "Change it" })).toBeVisible();

  // Edit the text and look on the result page, then download the new render.
  const first = page.url();
  const originalVideo = await page
    .getByLabel("Finished video")
    .getAttribute("src");
  const scene = page.getByLabel("Scene 1 text on screen");
  await scene.fill("Why does the sky look blue?");
  await scene.press("Tab");
  await page.getByLabel("Look").selectOption({ label: "Clean Story" });
  await page.getByRole("button", { name: "Update video" }).click();
  await page.waitForURL(
    (url) => url.toString() !== first && /\/results\//.test(url.pathname),
  );
  await expectPlayableVideo(page);
  await expect(page.getByLabel("Scene 1 text on screen")).toHaveValue(
    "Why does the sky look blue?",
  );
  await downloadMp4(page);

  await page.getByRole("button", { name: "Make other sizes" }).click();
  const sizes = page.getByRole("list", { name: "Other sizes" });
  await expect(sizes).toContainText("9:16: current video");
  for (const [format, dimensions] of [
    ["16:9", [960, 540]],
    ["1:1", [540, 540]],
  ] as const) {
    const link = sizes.getByRole("link", { name: `Open ${format} result` });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    const variant = await page.context().newPage();
    await variant.goto(href!);
    await expectPlayableVideo(variant);
    await expect(variant.getByLabel("Scene 1 text on screen")).toHaveValue(
      "Why does the sky look blue?",
    );
    await expect(variant.getByLabel("Look")).toHaveValue("clean-story");
    expect(
      await variant.getByLabel("Finished video").evaluate((element) => {
        const video = element as HTMLVideoElement;
        return [video.videoWidth, video.videoHeight];
      }),
    ).toEqual(dimensions);
    await downloadMp4(variant);
    await variant.close();
  }

  // Undo returns to the same finished file without submitting a render.
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url());
  });
  await page.getByRole("link", { name: /previous version/ }).click();
  await expect(page).toHaveURL(first);
  await expectPlayableVideo(page);
  await expect(page.getByLabel("Finished video")).toHaveAttribute(
    "src",
    originalVideo!,
  );
  expect(requests).toEqual([]);
});
