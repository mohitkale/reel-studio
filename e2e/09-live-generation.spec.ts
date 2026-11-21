import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { expectPlayableVideo, WRITER_PORT } from "./helpers";

test.use({ video: process.env.REEL_E2E_RECORD === "1" ? "on" : "off" });

type Step = {
  key: string;
  state: string;
  startedAt: string | null;
  finishedAt: string | null;
};

test("a voice retry preserves the storyboard and a reload resumes the live render", async ({
  page,
  request,
}, testInfo) => {
  const storyboard = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "e2e", "fixtures", "written.storyboard.json"),
      "utf8",
    ),
  ) as { title: string };
  const created = await request.post("/api/storyboards?createOnly=1", {
    data: { ...storyboard, title: "Live generation retry fixture" },
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { scriptId: string; hash: string };
  const submitted = await request.post("/api/production-jobs", {
    data: {
      kind: "video",
      scriptId: project.scriptId,
      idempotencyKey: `e2e-live-generation-${project.scriptId}`,
      quality: "draft",
      captions: "off",
      storyboard: {
        hash: project.hash,
        title: "Live generation retry fixture",
      },
      quickProduce: {
        enabled: true,
        mediaPreference: "none",
        voice: {
          enabled: true,
          providerId: "voiceforge",
          voiceId: "fixture-voice",
        },
      },
    },
  });
  expect(submitted.ok()).toBe(true);
  const { job } = (await submitted.json()) as { job: { id: string } };
  const resultUrl = `/results/${job.id}`;
  async function getJob() {
    const response = await request.get(`/api/production-jobs/${job.id}`);
    expect(response.ok()).toBe(true);
    return (
      (await response.json()) as {
        job: { state: string; steps: Step[]; scenePreviews?: unknown[] };
      }
    ).job;
  }

  const updates: { at: number; text: string }[] = [];
  await page.exposeFunction("recordProgress", (text: string) => {
    updates.push({ at: Date.now(), text });
  });
  await page.addInitScript(() => {
    const emit = (
      window as Window & { recordProgress?: (text: string) => void }
    ).recordProgress;
    let last = "";
    setInterval(() => {
      const current = document
        .querySelector<HTMLElement>('[data-testid="active-job-progress"]')
        ?.innerText.trim();
      const connecting = Array.from(
        document.querySelectorAll('[role="status"]'),
      )
        .find((element) =>
          element.textContent?.includes("Opening your saved video job"),
        )
        ?.textContent?.trim();
      const next = current || connecting || "";
      if (emit && next && next !== last) emit(next);
      last = next;
    }, 150);
  });

  await page.goto(resultUrl);
  const voiceStep = page
    .getByRole("listitem")
    .filter({ hasText: "Record the voice" });
  await expect(voiceStep).toContainText("Fixture voice is unavailable", {
    timeout: 60_000,
  });
  const failed = await getJob();
  expect(failed.state).toBe("failed");
  expect(
    failed.steps.find(({ key }) => key === "synthesize_audio")?.state,
  ).toBe("failed");
  const checkpointKeys = ["validate", "plan", "resolve_media"];
  const checkpoints = failed.steps.filter(({ key }) =>
    checkpointKeys.includes(key),
  );
  expect(checkpoints.map(({ state }) => state)).toEqual([
    "succeeded",
    "succeeded",
    "succeeded",
  ]);
  await page.screenshot({ path: testInfo.outputPath("voice-failure.png") });

  const available = await request.post(
    `http://127.0.0.1:${WRITER_PORT}/__fixture/voice-ready`,
  );
  expect(available.ok()).toBe(true);
  const retryAt = Date.now();
  await voiceStep.getByRole("button", { name: "Try this step again" }).click();
  const renderStep = page
    .locator('[aria-current="step"]')
    .filter({ hasText: "Export the video" });
  await expect(renderStep).toBeVisible({ timeout: 90_000 });
  const beforeReload = await getJob();
  expect(beforeReload.state).toBe("running");
  expect(
    beforeReload.steps.filter(({ key }) => checkpointKeys.includes(key)),
  ).toEqual(checkpoints);
  const renderStartedAt = beforeReload.steps.find(
    ({ key }) => key === "render_export",
  )?.startedAt;

  await page.reload();
  await expect(page).toHaveURL((url) => url.pathname === resultUrl);
  await expect(renderStep).toBeVisible({ timeout: 20_000 });
  expect(
    (await getJob()).steps.find(({ key }) => key === "render_export")
      ?.startedAt,
  ).toBe(renderStartedAt);

  const draft = page.getByRole("region", { name: "Draft preview" });
  await draft
    .getByRole("button", { name: "Play", exact: true })
    .click({ timeout: 25_000 });
  await expect
    .poll(() =>
      draft.getByRole("slider", { name: "Seek" }).inputValue().then(Number),
    )
    .toBeGreaterThan(0.25);
  await draft.getByRole("button", { name: "Pause", exact: true }).click();
  const scenes = page.getByRole("region", { name: "Scenes in this video" });
  await expect(scenes.locator("img")).toHaveCount(3, { timeout: 35_000 });
  await expect
    .poll(() =>
      scenes
        .locator("img")
        .evaluateAll((frames: HTMLImageElement[]) =>
          frames.every((frame) => frame.complete && frame.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("live-preview.png"),
    fullPage: true,
  });

  await expectPlayableVideo(page);
  const finishedAt = Date.now();
  const measured = updates.filter(({ at }) => at >= retryAt);
  const points = [retryAt, ...measured.map(({ at }) => at), finishedAt];
  const longestGapMs = Math.max(
    ...points.slice(1).map((at, i) => at - points[i]!),
  );
  expect(measured.some(({ text }) => /rendering/i.test(text))).toBe(true);
  expect(longestGapMs).toBeLessThanOrEqual(5_000);
  const report = {
    jobId: job.id,
    longestGapMs,
    beforeReload: renderStartedAt,
    updates: measured,
  };
  writeFileSync(
    testInfo.outputPath("progress-timing.json"),
    JSON.stringify(report, null, 2),
  );
  const finished = await getJob();
  expect(finished.state).toBe("succeeded");
  expect(
    finished.steps.filter(({ key }) => checkpointKeys.includes(key)),
  ).toEqual(checkpoints);
});
