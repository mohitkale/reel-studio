/** Offline preview/native-seek evidence and real portrait/landscape exports.
 * Run with node --import tsx; REEL_VERIFY_CHROME selects an installed browser.
 * Never downloads a browser or model. Outputs are ignored under .artifacts. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
import { defaultBrandTokens } from "../src/video/tokens.ts";

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const root = path.resolve(".artifacts/m9-fidelity");
await mkdir(root, { recursive: true });
const report = [];
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.REEL_VERIFY_CHROME || puppeteer.executablePath(),
});
try {
  for (const [orientation, width, height] of [
    ["portrait", 540, 960],
    ["landscape", 960, 540],
  ]) {
    const props = {
      width,
      height,
      fps: 30,
      tokens: {
        ...defaultBrandTokens,
        background: "#f1eee5",
        backgroundAccent: "#ded7c5",
        foreground: "#172030",
        accent: "#2059a3",
        fontFamily: "Inter",
      },
      scenes: [
        {
          id: "serif",
          templateId: "hf-quote",
          text: "Создавайте полезные истории. Καλή ιδέα, καθαρή εικόνα.",
          emphasis: [],
          mood: "calm",
        },
        {
          id: "copy",
          templateId: "hf-statement",
          text: "A complete idea needs room to breathe. Keep every authored word visible, measure the actual font, and split longer stories into clear scenes that people can read without rushing through the message.",
          emphasis: ["every authored word"],
        },
        {
          id: "ambient",
          templateId: "hf-opener",
          text: "Keep the story moving.",
          emphasis: [],
        },
      ],
      timeline: [
        { sceneId: "serif", startFrame: 0, durationFrames: 90 },
        { sceneId: "copy", startFrame: 90, durationFrames: 90 },
        { sceneId: "ambient", startFrame: 180, durationFrames: 270 },
      ],
    };
    const preview = buildHyperframesCompositionHtml(props);
    const producer = buildHyperframesCompositionHtml(props, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
    });
    const server = createServer(async (request, response) => {
      const pathname = new URL(request.url, "http://localhost").pathname;
      try {
        if (pathname === "/favicon.ico") {
          response.writeHead(204).end();
        } else if (pathname === "/preview") {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            `<iframe style="border:0;width:${width}px;height:${height}px" id="preview"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(preview).replaceAll("<", "\\u003c")}</script>`,
          );
        } else if (pathname === "/producer") {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(producer);
        } else {
          response.setHeader(
            "Content-Type",
            pathname.endsWith(".js") ? "text/javascript" : "font/woff2",
          );
          response.end(
            await readFile(
              path.resolve("public/reel-runtime", path.basename(pathname)),
            ),
          );
        }
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    const errors = [],
      external = [],
      missing = [],
      fonts = new Set();
    await page.setViewport({ width: width + 16, height: height + 16 });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(base)) {
        external.push(request.url());
        request.abort();
      } else {
        if (request.url().endsWith(".woff2"))
          fonts.add(path.basename(request.url()));
        request.continue();
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) missing.push(response.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const states = {};
      for (const mode of ["producer", "preview"]) {
        await page.goto(`${base}/${mode}`, { waitUntil: "networkidle0" });
        const frame =
          mode === "preview"
            ? page.frames().find((frame) => frame !== page.mainFrame())
            : page.mainFrame();
        await frame.evaluate(() => document.fonts.ready);
        const results = [];
        for (const time of [1.5, 2.97, 3, 3.3, 3.65, 4.8, 8, 12, 1.5]) {
          results.push(
            await frame.evaluate((time) => {
              window.__timelines.reel.seek(time, true);
              // Producer owns clip visibility. Model its declared windows here;
              // actual exports below independently exercise the real adapter.
              if (!window.__reelSeek)
                document.querySelectorAll(".scene").forEach((scene) => {
                  const active =
                    time >= Number(scene.dataset.start) &&
                    time <
                      Number(scene.dataset.start) +
                        Number(scene.dataset.duration);
                  scene.style.visibility = active ? "visible" : "hidden";
                });
              return Array.from(document.querySelectorAll(".scene")).map(
                (scene) => ({
                  id: scene.dataset.sceneId,
                  visible: getComputedStyle(scene).visibility,
                  handoff: getComputedStyle(
                    scene.querySelector(".scene-handoff"),
                  ).opacity,
                  font: getComputedStyle(scene.querySelector(".fx-line-inner"))
                    .fontFamily,
                  color: getComputedStyle(scene.querySelector(".fx-stack"))
                    .color,
                  fit: scene.querySelector(".fx-stack").dataset.textFitScale,
                  content: Array.from(scene.querySelectorAll(".fx-line-inner"))
                    .map((line) => line.textContent.trim())
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim(),
                  overflow:
                    scene.querySelector(".fx-stack").offsetHeight >
                      scene.querySelector(".fx-stage").clientHeight * 0.62 +
                        2 ||
                    Array.from(scene.querySelectorAll(".fx-line-inner")).some(
                      (line) =>
                        line.scrollWidth > line.parentElement.clientWidth + 2,
                    ),
                  ambient:
                    scene.querySelector(".fx-studio-beam")?.style.transform,
                }),
              );
            }, time),
          );
          if ([2.97, 3.3, 4.8, 12].includes(time))
            await page.screenshot({
              path: path.join(root, `${orientation}-${mode}-${time}.png`),
            });
        }
        assert.deepEqual(
          results[0],
          results.at(-1),
          "backward/repeated seek must restore the same pose",
        );
        assert.ok(
          results.every((result) => result.every((scene) => !scene.overflow)),
          "complete lines must fit",
        );
        assert.match(results[0][0].font, /EB Garamond/);
        assert.equal(results[0][1].content, props.scenes[1].text);
        assert.equal(results[0][0].color, "rgb(23, 32, 48)");
        assert.notEqual(
          results[6][2].ambient,
          results[7][2].ambient,
          "ambient motion must continue after six seconds",
        );
        states[mode] = results;
      }
      assert.deepEqual(
        states.preview,
        states.producer,
        "offline srcDoc preview and callback-suppressed native seeks must agree",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      assert.deepEqual(missing, []);
      assert.ok([...fonts].some((name) => name.includes("cyrillic")));
      assert.ok([...fonts].some((name) => name.includes("greek")));
      report.push({
        orientation,
        states,
        fonts: [...fonts],
        errors,
        external,
        missing,
      });
    } finally {
      await page.close();
      await new Promise((resolve) => server.close(resolve));
    }
    const project = path.join(root, orientation);
    await mkdir(project, { recursive: true });
    await copyHyperframesRuntime(path.join(project, "_runtime"));
    await writeFile(path.join(project, "index.html"), producer);
    if (!process.argv.includes("--preview-only"))
      await new Promise((resolve, reject) => {
        const worker = spawn(
          process.execPath,
          [
            "scripts/hyperframes-render-worker.mjs",
            project,
            path.join(root, `${orientation}.mp4`),
            "30",
            "draft",
          ],
          { stdio: "inherit" },
        );
        worker.once("error", reject);
        worker.once("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`Native export failed: ${code}`)),
        );
      });
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(root, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  "Offline preview, fonts, fitting, repeated/native seeks and ambient motion verified.",
);
