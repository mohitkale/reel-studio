import { expect, test } from "@playwright/test";

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
