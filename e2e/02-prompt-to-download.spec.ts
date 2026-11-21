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

  // The result's scene strip reuses the editor's durable history.
  const strip = page.getByRole("list", { name: "Scene strip" });
  const firstScene = strip.getByRole("listitem").first();
  await firstScene.getByRole("button", { name: "Scene type" }).click();
  await page
    .getByLabel("Scene type", { exact: true })
    .selectOption({ label: "Quote" });
  await page.getByRole("button", { name: "Use this scene type" }).click();
  await expect(firstScene).toContainText("Pull quote");
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(firstScene).not.toContainText("Pull quote");
  await page
    .getByTestId("drag-scene-1")
    .dragTo(strip.getByRole("listitem").nth(1));
  await expect(page.getByLabel("Scene 1 text on screen")).toHaveValue(
    "Blue light scatters most",
  );
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(page.getByLabel("Scene 1 text on screen")).toHaveValue(
    "Why does the sky look blue?",
  );
  await firstScene.getByRole("button", { name: "Delete scene 1" }).click();
  await expect(strip.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(strip.getByRole("listitem")).toHaveCount(3);

  await firstScene.getByRole("button", { name: "Regenerate copy" }).click();
  const changes = page.getByRole("list", { name: "Changes" });
  await expect(changes).toContainText("Scene 1");
  await expect(changes).not.toContainText("Scene 2");
  await page.getByRole("button", { name: "Discard" }).click();
  const shorterRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/storyboards/write") &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "Shorter", exact: true }).click();
  expect(
    (await shorterRequest).postDataJSON().brief.revise.instruction,
  ).toMatch(/25% shorter/);
  await expect(
    page.getByRole("button", { name: "Make this version" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await firstScene.getByRole("button", { name: "Regenerate copy" }).click();
  await expect(changes).toContainText("Scene 1");
  await page.getByRole("button", { name: "Make this version" }).click();
  await page.waitForURL(
    (url) => url.searchParams.get("from") === first.split("/results/")[1],
  );
  await expectPlayableVideo(page);
  await expect(page.getByLabel("Scene 1 text on screen")).toHaveValue(
    "Why is the sky blue?",
  );
  await expect(page.getByLabel("Scene 2 text on screen")).toHaveValue(
    "Blue light scatters most",
  );
});
