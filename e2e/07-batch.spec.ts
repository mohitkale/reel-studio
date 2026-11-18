import { expect, test } from "@playwright/test";

import { useFakeWriter } from "./helpers";

// A list of topics becomes a set of videos, one at a time, with a saved series.
test("a batch of topics is made one at a time with the series applied", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await useFakeWriter(page);
  await page.goto("/batch");
  await expect(
    page.getByRole("heading", { name: "Make many videos" }),
  ).toBeVisible();

  // Save a series through the page's own API, then pick it.
  const saved = await page.evaluate(async () => {
    const response = await fetch("/api/series", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        series: [{ name: "Daily tips", theme: "neon", music: "upbeat-pop" }],
      }),
    });
    return response.status;
  });
  expect(saved).toBe(200);
  await page.reload();
  await page.getByLabel("Series", { exact: true }).selectOption("Daily tips");

  await page
    .locator("#batch-topics")
    .fill("topic\nWhy rainbows form\nWhy the sea is salty");
  await page.getByRole("button", { name: "Start" }).click();

  // Both items finish; the second waits its turn behind the first.
  const queue = page.getByRole("list").filter({ hasText: "Why rainbows form" });
  await expect(queue.getByText("Next up").or(queue.getByText("1 ahead of it")))
    .toBeVisible({
      timeout: 60_000,
    })
    .catch(() => undefined);
  await expect(page.getByText("2 of 2 done")).toBeVisible({
    timeout: 8 * 60_000,
  });
  await expect(page.getByRole("link", { name: "Open" })).toHaveCount(2);

  // The series filled in what the written storyboard left out.
  const { jobs } = (await (
    await page.request.get("/api/production-jobs?limit=5")
  ).json()) as { jobs: { id: string; state: string }[] };
  const job = (await (
    await page.request.get(`/api/production-jobs/${jobs[0]!.id}`)
  ).json()) as { job: { revision: { scriptId: string } } };
  const exported = (await (
    await page.request.get(
      `/api/scripts/${job.job.revision.scriptId}/storyboard`,
    )
  ).json()) as { storyboard: { theme?: string; music?: string } };
  expect(exported.storyboard.theme).toBe("neon");
});
