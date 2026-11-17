import { expect, test } from "@playwright/test";

import { downloadMp4, expectPlayableVideo } from "./helpers";

// Journey 1: a clean install, first-run setup, and a playable first video with no AI.
test("onboarding ends on a playable video with no key", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Set up in under a minute.*step 1 of 3/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: /step 2 of 3/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Continue \(or skip the voice\)/ })
    .click();

  await expect(
    page.getByRole("heading", { name: /step 3 of 3/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /I'll paste it myself/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Finish and make a sample video/ })
    .click();

  await page.waitForURL(/\/results\//);
  await expectPlayableVideo(page);
  await downloadMp4(page);

  // Setup shows once.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Set up in under a minute/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "What do you want to make?" }),
  ).toBeVisible();
});
