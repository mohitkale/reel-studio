import { expect, test } from "@playwright/test";

import { seriousAccessibilityFindings } from "./helpers";

// No critical or serious axe findings on Create, Result, Library and Settings.
// Runs after the journeys, so the result page has a real video to check.
test.describe("accessibility", () => {
  let resultPath = "";
  test.beforeAll(async ({ request }) => {
    const response = await request.get("/api/production-jobs?limit=5");
    const { jobs } = (await response.json()) as {
      jobs: { id: string; state: string }[];
    };
    const done = jobs.find((job) => job.state === "succeeded");
    resultPath = done ? `/results/${done.id}` : "";
  });

  for (const [name, path] of [
    ["Create", "/"],
    ["Library", "/library"],
    ["Settings", "/settings"],
  ] as const) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await seriousAccessibilityFindings(page)).toEqual([]);
    });
  }

  test("Result", async ({ page }) => {
    expect(resultPath, "a finished video from the journeys").not.toBe("");
    await page.goto(resultPath);
    await expect(page.getByLabel("Finished video")).toBeVisible();
    expect(await seriousAccessibilityFindings(page)).toEqual([]);
  });
});
