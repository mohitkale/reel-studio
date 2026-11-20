import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const destinations = [
  ["Create", "/"],
  ["Library", "/library"],
  ["Podcasts", "/podcasts"],
  ["Brand", "/brand-kits"],
  ["Settings", "/settings"],
] as const;

// Sidebar destinations before Simple mode, plus the system check now under Settings.
const priorRoutes = [
  "/",
  "/podcasts",
  "/voiceovers",
  "/factory",
  "/editor",
  "/voices",
  "/templates",
  "/gallery",
  "/assets",
  "/brand-kits",
  "/renders",
  "/settings",
  "/diagnostics",
];

test("Simple shows five labelled destinations and old workspace URLs still open", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const mode = await page.evaluate(async () => {
    const response = await fetch("/api/ui-mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "simple", onboarded: true }),
    });
    return response.status;
  });
  expect(mode).toBe(200);
  await page.reload();
  const sidebar = page.locator("aside").getByRole("navigation");
  await expect(sidebar.getByRole("link")).toHaveText(
    destinations.map(([name]) => name),
  );
  await sidebar.screenshot({ path: testInfo.outputPath("simple-sidebar.png") });
  for (const [name, route] of destinations) {
    const link = sidebar.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL((url) => url.pathname === route);
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  await expect(
    page.getByText("System readiness", { exact: true }),
  ).toBeVisible();
  const systemCheck = page.getByRole("link", { name: "Run system check" });
  await systemCheck.click();
  await expect(page).toHaveURL((url) => url.pathname === "/diagnostics");

  for (const route of priorRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByRole("main")).toBeVisible();
  }
});

test("Pro opens the manual workspaces and a voiceover waveform", async ({
  page,
  request,
}) => {
  const name = "Pro navigation audio fixture";
  const created = await request.post("/api/projects/manual", {
    data: {
      name,
      outputType: "voiceover",
      orientation: "portrait",
      videoEngine: "hyperframes",
      presetId: "editorial-explainer",
      source: {
        kind: "text",
        text: "A short local fixture for the voiceover controls.",
      },
    },
  });
  expect(created.ok()).toBe(true);
  const { scriptId } = (await created.json()) as { scriptId: string };
  const saved = await request.get(`/api/scripts/${scriptId}`);
  expect(saved.ok()).toBe(true);
  const { script } = (await saved.json()) as {
    script: { scenes: { id: string }[] };
  };
  const wavBase64 = readFileSync(
    path.join(process.cwd(), "public", "sfx", "sting-intro.wav"),
    "base64",
  );
  const take = await request.post(`/api/scripts/${scriptId}/takes/upload`, {
    data: {
      providerId: "kokoro",
      voiceId: "af_heart",
      beats: script.scenes.map(({ id }) => ({ sceneId: id, wavBase64 })),
    },
  });
  expect(take.ok()).toBe(true);

  await page.goto("/");
  const pro = page.getByRole("radio", { name: "Pro", exact: true });
  await pro.click();
  await expect(pro).toHaveAttribute("aria-checked", "true");
  const sidebar = page.locator("aside").getByRole("navigation");

  for (const [name, href] of [
    ["Batches", "/factory"],
    ["Templates", "/templates"],
    ["Assets", "/assets"],
    ["Gallery", "/gallery"],
    ["Editor", "/editor"],
    ["Voiceovers", "/voiceovers"],
  ] as const) {
    await sidebar.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.getByRole("main")).toBeVisible();
  }

  const voiceover = page.getByRole("article").filter({ hasText: name });
  await voiceover.getByRole("link", { name: "Open voiceover" }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === `/voiceovers/${scriptId}`,
  );
  await expect(
    page.getByRole("heading", { name: "Waveform & transcript" }),
  ).toBeVisible();
  const simple = page.getByRole("radio", { name: "Simple", exact: true });
  await simple.click();
  await expect(simple).toHaveAttribute("aria-checked", "true");
});
