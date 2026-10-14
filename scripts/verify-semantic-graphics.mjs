/** Offline visual-meaning admission, seek parity and actual isolated exports. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { semanticGraphicsFixture } from "../tests/fixtures/semantic-graphics.ts";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
import { semanticGraphicCaptions } from "../src/production/semantic-direction.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const root = path.resolve(".artifacts/content-direction/semantic-matrix");
await mkdir(root, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
});
const cases = [];
try {
  for (const [orientation, width, height] of [
    ["portrait", 540, 960],
    ["landscape", 960, 540],
    ["square", 540, 540],
  ]) {
    const props = semanticGraphicsFixture(width, height);
    const preview = buildHyperframesCompositionHtml(props);
    const producer = buildHyperframesCompositionHtml(props, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
    });
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      try {
        if (pathname === "/favicon.ico") res.writeHead(204).end();
        else if (pathname === "/preview")
          res
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .end(
              `<style>body{margin:0}</style><iframe id="preview" style="width:${width}px;height:${height}px;border:0"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(preview).replaceAll("<", "\\u003c")}</script>`,
            );
        else if (pathname === "/producer")
          res
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .end(producer);
        else
          res
            .setHeader(
              "Content-Type",
              pathname.endsWith(".js") ? "text/javascript" : "font/woff2",
            )
            .end(
              await readFile(
                path.resolve("public/reel-runtime", path.basename(pathname)),
              ),
            );
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    const errors = [],
      external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(base)) {
        external.push(request.url());
        request.abort();
      } else request.continue();
    });
    const modes = {};
    try {
      for (const mode of ["preview", "producer"]) {
        await page.goto(`${base}/${mode}`, { waitUntil: "networkidle0" });
        const frame =
          mode === "preview"
            ? page.frames().find((value) => value !== page.mainFrame())
            : page.mainFrame();
        await frame.evaluate(() => document.fonts.ready);
        const sample = async (time) =>
          frame.evaluate((time) => {
            window.__timelines.reel.seek(time, true);
            if (!window.__reelSeek)
              document.querySelectorAll(".scene").forEach((scene) => {
                scene.style.visibility =
                  time >= Number(scene.dataset.start) &&
                  time <
                    Number(scene.dataset.start) + Number(scene.dataset.duration)
                    ? "visible"
                    : "hidden";
              });
            const scene = Array.from(
              document.querySelectorAll(".scene"),
            ).findLast(
              (value) => getComputedStyle(value).visibility === "visible",
            );
            const stage = scene.querySelector("[data-semantic-block]");
            const bounds = stage.getBoundingClientRect();
            const text = Array.from(
              stage.querySelectorAll(".sg-headline,.sg-label,.sg-detail"),
            ).map((el) => {
              const range = document.createRange();
              range.selectNodeContents(el);
              const rect = range.getBoundingClientRect();
              let opacity = 1;
              for (
                let parent = el;
                parent && parent !== scene;
                parent = parent.parentElement
              )
                opacity *= Number(getComputedStyle(parent).opacity);
              return {
                text: el.textContent,
                font: Number.parseFloat(getComputedStyle(el).fontSize),
                opacity,
                bounds: [rect.left, rect.top, rect.right, rect.bottom].map(
                  (v) => Math.round(v * 1000) / 1000,
                ),
                outside:
                  rect.left < bounds.left - 2 ||
                  rect.right > bounds.right + 2 ||
                  rect.top < bounds.top - 2 ||
                  rect.bottom > bounds.bottom + 2,
              };
            });
            return {
              id: scene.dataset.sceneId,
              kind: stage.dataset.semanticBlock,
              warning: stage.dataset.textFitWarning ?? null,
              text,
              paths: Array.from(
                stage.querySelectorAll(
                  ".sg-art path,.sg-art rect,.sg-art circle",
                ),
              ).map((el) => ({
                offset: el.style.strokeDashoffset,
                transform: el.parentElement.style.transform,
              })),
            };
          }, time);
        const states = [];
        for (const [index, scene] of props.scenes.entries()) {
          const early = await sample(index * 6 + 0.2);
          const settled = await sample(index * 6 + 1.8);
          if (settled.warning) {
            await page.screenshot({
              path: path.join(root, `${orientation}-fit-failure.png`),
            });
            console.error(
              await frame.evaluate(
                () =>
                  Array.from(document.querySelectorAll(".scene"))
                    .findLast(
                      (el) => getComputedStyle(el).visibility === "visible",
                    )
                    ?.querySelector("[data-semantic-block]")?.outerHTML,
              ),
            );
          }
          assert.equal(settled.id, scene.id);
          assert.equal(
            settled.warning,
            null,
            `${orientation} ${scene.id} fit warning`,
          );
          assert.ok(
            settled.text.every(
              (value) =>
                !value.outside && value.opacity >= 0.98 && value.font >= 22,
            ),
            `${orientation} ${scene.id} clips or hides copy`,
          );
          assert.deepEqual(
            settled.text.map((value) => value.text),
            [
              scene.text,
              ...semanticGraphicCaptions(
                scene.text,
                scene.direction.graphic,
              ).flatMap((node) => [
                node.label,
                ...(node.detail ? [node.detail] : []),
              ]),
            ],
          );
          for (const [a, first] of settled.text.entries())
            for (const second of settled.text.slice(a + 1)) {
              const overlapX =
                Math.min(first.bounds[2], second.bounds[2]) -
                Math.max(first.bounds[0], second.bounds[0]);
              const overlapY =
                Math.min(first.bounds[3], second.bounds[3]) -
                Math.max(first.bounds[1], second.bounds[1]);
              assert.ok(
                overlapX <= 2 || overlapY <= 2,
                `${orientation} ${scene.id} overlaps labels`,
              );
            }
          assert.notDeepEqual(
            early.paths,
            settled.paths,
            "Illustration must animate, not only its caption",
          );
          await sample(index * 6 + 3);
          assert.deepEqual(
            await sample(index * 6 + 1.8),
            settled,
            "Reverse seek must restore the same pose",
          );
          await page.screenshot({
            path: path.join(root, `${orientation}-${mode}-${scene.id}.png`),
          });
          states.push(settled);
        }
        modes[mode] = states;
      }
      assert.deepEqual(
        modes.preview,
        modes.producer,
        "Native preview/export layout and poses must match",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await page.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
    const result = { orientation, modes, errors, external };
    if (!process.argv.includes("--preview-only")) {
      const project = path.join(root, orientation);
      await mkdir(project, { recursive: true });
      await copyHyperframesRuntime(path.join(project, "_runtime"));
      await writeFile(path.join(project, "index.html"), producer);
      const output = path.join(root, `${orientation}.mp4`);
      await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "scripts/hyperframes-render-worker.mjs",
            project,
            output,
            "24",
            "draft",
          ],
          { stdio: "inherit" },
        );
        child.once("error", reject);
        child.once("exit", (code) =>
          code === 0 ? resolve() : reject(new Error(`Export failed: ${code}`)),
        );
      });
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=width,height",
            "-of",
            "json",
            output,
          ],
          { encoding: "utf8" },
        ),
      );
      assert.equal(probe.streams[0].width, width);
      assert.equal(probe.streams[0].height, height);
      assert.equal(Number(probe.format.duration), props.scenes.length * 6);
      result.export = {
        probe,
        sha256: createHash("sha256")
          .update(await readFile(output))
          .digest("hex"),
      };
      for (const [index, scene] of props.scenes.entries()) {
        const files = [];
        for (const [suffix, offset] of [
          ["early", 0.2],
          ["settled", 1.8],
        ]) {
          const file = path.join(
            root,
            `${orientation}-export-${scene.id}-${suffix}.png`,
          );
          execFileSync(
            "ffmpeg",
            [
              "-y",
              "-ss",
              String(index * 6 + offset),
              "-i",
              output,
              "-frames:v",
              "1",
              file,
            ],
            { stdio: "ignore" },
          );
          files.push(
            createHash("sha256")
              .update(await readFile(file))
              .digest("hex"),
          );
        }
        assert.notEqual(
          files[0],
          files[1],
          "Actual exported illustration must animate",
        );
      }
    }
    cases.push(result);
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(root, "report.json"),
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      exportsExecuted: !process.argv.includes("--preview-only"),
      cases,
    },
    null,
    2,
  ),
);
console.log(
  "Semantic content, readability, choreography, reverse-seek and preview/export parity passed.",
);
