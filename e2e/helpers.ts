import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const WRITER_PORT = Number(process.env.E2E_WRITER_PORT ?? "3199");

/** Sets up the fake local writer as the studio's storyboard writer. */
export async function useFakeWriter(page: Page): Promise<void> {
  const response = await page.request.post("/api/ai/local-config", {
    data: {
      providerId: "ollama",
      config: {
        baseUrl: `http://127.0.0.1:${WRITER_PORT}`,
        modelId: "fixture:latest",
        temperature: 0.2,
        allowLan: false,
      },
    },
  });
  expect(response.status()).toBe(200);
}

/** Waits for a finished video on a result page and checks it can play. */
export async function expectPlayableVideo(page: Page): Promise<void> {
  await expect(page.getByText("Ready to download")).toBeVisible({
    timeout: 8 * 60_000,
  });
  const video = page.getByLabel("Finished video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
}

/** Downloads the MP4 from a result page and checks the file is not empty. */
export async function downloadMp4(page: Page): Promise<void> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Download MP4/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.mp4$/i);
  const file = await download.path();
  expect(readFileSync(file).byteLength).toBeGreaterThan(10_000);
}

export interface Focus {
  tag: string;
  label: string;
  visible: boolean;
  indicator: boolean;
}

/** What has keyboard focus, and whether it shows a visible focus indicator. */
export function activeFocus(page: Page): Promise<Focus> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { tag: "", label: "", visible: false, indicator: false };
    const style = getComputedStyle(el);
    const outline =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none";
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute("aria-label") || el.id || el.textContent || "")
        .trim()
        .slice(0, 60),
      visible: el.matches(":focus-visible"),
      indicator: outline || shadow,
    };
  });
}

/**
 * Press Tab until `done` says the right element has focus, asserting each
 * element passed on the way shows a visible focus indicator.
 */
export async function tabTo(
  page: Page,
  done: (focus: Focus) => boolean,
  max = 90,
): Promise<Focus> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const focus = await activeFocus(page);
    expect(
      focus.visible && focus.indicator,
      `no visible focus on <${focus.tag}> "${focus.label}"`,
    ).toBe(true);
    if (done(focus)) return focus;
  }
  throw new Error("The keyboard never reached the element");
}

/** Run axe-core on the page; returns critical and serious findings. */
export async function seriousAccessibilityFindings(page: Page) {
  await page.addScriptTag({
    content: readFileSync(
      path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
      "utf8",
    ),
  });
  return page.evaluate(async () => {
    type Axe = {
      run: (ctx: Document) => Promise<{
        violations: {
          id: string;
          impact: string | null;
          nodes: { target: unknown[] }[];
        }[];
      }>;
    };
    const result = await (window as unknown as { axe: Axe }).axe.run(document);
    return result.violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      }));
  });
}
