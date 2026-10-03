/** Generate first-shot thumbnails from the shipped, renderable preset fixtures. */
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { PRODUCTION_PRESET_IDS } from "../src/production/presets.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
await mkdir("public/preset-previews", { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.PUPPETEER_EXECUTABLE_PATH || (await puppeteer.executablePath()),
});
try {
  for (const id of PRODUCTION_PRESET_IDS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 360 });
    const fixture = JSON.parse(
      await readFile(`tests/fixtures/${id}-reel.json`, "utf8"),
    );
    const scene = fixture.scenes[0];
    await page.setContent(
      buildHyperframesCompositionHtml({
        ...fixture,
        width: 640,
        height: 360,
        hideProgressBar: true,
        scenes: [scene],
        timeline: [{ sceneId: scene.id, startFrame: 0, durationFrames: 180 }],
      }),
      { waitUntil: "domcontentloaded" },
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.__timelines.reel.seek(1.8, true);
    });
    await page.screenshot({ path: `public/preset-previews/${id}.png` });
    await page.close();
  }
  console.log("Six actual preset composition thumbnails generated.");
} finally {
  await browser.close();
}
