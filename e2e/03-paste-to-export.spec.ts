import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { downloadMp4, expectPlayableVideo } from "./helpers";

const storyboard = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "e2e", "fixtures", "written.storyboard.json"),
    "utf8",
  ),
) as { title: string };

// Journey 3: no key. Copy the prompt, paste a reply, check it, make and export the video.
test("paste a reply, make the video, export it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.locator("#one-prompt-input").fill("Why the sky is blue");
  await page.getByText("More options").click();
  await page.getByLabel(/Quick draft/).check();

  await page.getByText(/Use my own chat assistant/).click();
  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Why the sky is blue");

  const reply = `Here you go:\n\`\`\`json\n${JSON.stringify({ ...storyboard, title: "Why the sky is blue, pasted" })}\n\`\`\`\nHope that helps.`;
  await page.locator("#pasted-reply").fill(reply);
  await page.getByRole("button", { name: "Make the video" }).click();

  await page.waitForURL(/\/results\//);
  await expectPlayableVideo(page);
  await downloadMp4(page);
});
