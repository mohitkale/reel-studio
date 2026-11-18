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

  // Change the look, make the video again, and download it.
  const first = page.url();
  await page.getByLabel("Look").selectOption({ label: "Clean Story" });
  await page.getByRole("button", { name: "Update video" }).click();
  await page.waitForURL(
    (url) => url.toString() !== first && /\/results\//.test(url.pathname),
  );
  await expectPlayableVideo(page);
  // The earlier version is kept and one click away; nothing is made again.
  await expect(
    page.getByRole("link", { name: /previous version/ }),
  ).toHaveAttribute("href", new RegExp(`${first.split("/results/")[1]}$`));
  await downloadMp4(page);
});
