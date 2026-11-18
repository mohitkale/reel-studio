import { expect, test } from "@playwright/test";

// The writer-driven change box and the "what runs by itself" switches, on the
// video the journeys already made. The fake writer returns the same storyboard,
// so the box reports no changes (or lists a few): either way it shows its answer.
test("tell me what to change shows the writer's answer before anything is made", async ({
  page,
  request,
}) => {
  const { jobs } = (await (
    await request.get("/api/production-jobs?limit=5")
  ).json()) as { jobs: { id: string; state: string }[] };
  const done = jobs.find((job) => job.state === "succeeded");
  expect(done, "a finished video from the journeys").toBeTruthy();
  await page.goto(`/results/${done!.id}`);
  await expect(page.getByLabel("Finished video")).toBeVisible();

  await page
    .getByLabel("What should change in this video")
    .fill("Make the opening shorter");
  await page.getByRole("button", { name: "Show me the changes" }).click();
  await expect(
    page
      .getByText(/The writer made no changes/)
      .or(page.getByRole("button", { name: "Make this version" })),
  ).toBeVisible({ timeout: 60_000 });
});

test("automation defaults save and show on the Create screen", async ({
  page,
}) => {
  await page.goto("/settings");
  const captions = page.getByLabel("Show captions");
  await expect(captions).toBeEnabled();
  await expect(captions).toBeChecked();
  await captions.click();
  await expect(captions).not.toBeChecked();
  await expect
    .poll(async () => {
      const state = await (await page.request.get("/api/ui-mode")).json();
      return state.automation.captions;
    })
    .toBe(false);

  await page.goto("/");
  await page.getByText("More options").click();
  await expect(page.getByLabel("Show captions")).not.toBeChecked();

  // Put it back so nothing after this depends on it.
  await page.goto("/settings");
  await expect(page.getByLabel("Show captions")).toBeEnabled();
  await page.getByLabel("Show captions").click();
  await expect(page.getByLabel("Show captions")).toBeChecked();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/ui-mode")).json()).automation
          .captions,
    )
    .toBe(true);
});

test("the pronunciation preview shows what the voice is given", async ({
  page,
}) => {
  await page.goto("/settings");
  const preview = page.getByText(/The voice is given:/).locator("..");
  await expect(preview).toContainText("two million dollars");
  await expect(preview).toContainText("November thirteenth, 2026");
  await expect(preview).toContainText("forty percent");
  await expect(preview).toContainText("sequel");
  await expect(preview).toContainText("example dot com");
});

test("the publishing kit shows copyable text, platform fit and a zip", async ({
  page,
  request,
}) => {
  const { jobs } = (await (
    await request.get("/api/production-jobs?limit=5")
  ).json()) as { jobs: { id: string; state: string }[] };
  const done = jobs.find((job) => job.state === "succeeded");
  expect(done, "a finished video from the journeys").toBeTruthy();
  await page.goto(`/results/${done!.id}`);
  await expect(
    page.getByRole("heading", { name: "Publishing kit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy description" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Fit on each platform" }),
  ).toContainText("YouTube");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Download the kit/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("publishing-kit.zip");
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(await download.path());
  // A zip starts with "PK"; the file names are stored in the clear.
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.toString("latin1")).toContain("description.txt");
  expect(bytes.toString("latin1")).toContain("storyboard.json");
});

test("the thumbnail endpoint returns PNGs at both sizes", async ({
  request,
}) => {
  const { jobs } = (await (
    await request.get("/api/production-jobs?limit=5")
  ).json()) as { jobs: { id: string; state: string }[] };
  const done = jobs.find((job) => job.state === "succeeded");
  expect(done, "a finished video from the journeys").toBeTruthy();
  for (const [size, width, height] of [
    ["landscape", 1280, 720],
    ["vertical", 1080, 1920],
  ] as const) {
    const response = await request.get(
      `/api/production-jobs/${done!.id}/thumbnail?size=${size}`,
      { timeout: 90_000 },
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const bytes = await response.body();
    // PNG signature, then the IHDR width and height.
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
  }
});

test("shorts cutdowns list what they would make, or say plainly that the video is too short", async ({
  request,
}) => {
  const { jobs } = (await (
    await request.get("/api/production-jobs?limit=5")
  ).json()) as { jobs: { id: string; state: string }[] };
  const done = jobs.find((job) => job.state === "succeeded");
  expect(done, "a finished video from the journeys").toBeTruthy();
  const view = (await (
    await request.get(`/api/production-jobs/${done!.id}`)
  ).json()) as { job: { revision: { scriptId: string } } };
  const response = await request.post(
    `/api/scripts/${view.job.revision.scriptId}/cutdowns`,
    { data: { preview: true } },
  );
  // Which answer depends on the video's length; both are the route doing its job.
  if (response.status() === 422) {
    expect(JSON.stringify(await response.json())).toMatch(/too short/i);
    return;
  }
  expect(response.status()).toBe(200);
  const { shorts } = (await response.json()) as {
    shorts: { title: string; seconds: number }[];
  };
  expect(shorts.length).toBeGreaterThanOrEqual(1);
  expect(shorts.length).toBeLessThanOrEqual(3);
  for (const short of shorts) {
    expect(short.title.length).toBeGreaterThan(0);
    expect(short.seconds).toBeLessThanOrEqual(45);
  }
});
