/** M10: offline graph seeks and actual export; uses installed browser/runtime. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { graphFixture } from "../tests/fixtures/motion-graph.ts";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const root = path.resolve(".artifacts/m10-motion-spec");
await mkdir(root, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
});
const report = [];
try {
  for (const [orientation, width, height] of [
    ["portrait", 540, 960],
    ["landscape", 960, 540],
  ]) {
    const props = { ...graphFixture(), width, height };
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
            .setHeader("Content-Type", "text/html")
            .end(
              `<iframe id="preview" style="width:${width}px;height:${height}px;border:0"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(preview).replaceAll("<", "\\u003c")}</script>`,
            );
        else if (pathname === "/producer")
          res.setHeader("Content-Type", "text/html").end(producer);
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
    const errors = [],
      external = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) {
        external.push(req.url());
        req.abort();
      } else req.continue();
    });
    await page.setViewport({ width, height });
    try {
      const modes = {};
      for (const mode of ["preview", "producer"]) {
        await page.goto(`${base}/${mode}`, { waitUntil: "networkidle0" });
        const frame =
          mode === "preview"
            ? page.frames().find((f) => f !== page.mainFrame())
            : page.mainFrame();
        await frame.evaluate(() => document.fonts.ready);
        const states = [];
        for (const time of [0.1, 0.6, 1.5, 2.8, 3.3, 4, 0.1]) {
          states.push(
            await frame.evaluate((t) => {
              window.__timelines.reel.seek(t, true);
              // Producer owns clip visibility; simulate its declared windows
              // for native-timeline probes. Actual exports exercise the adapter.
              if (!window.__reelSeek)
                document.querySelectorAll(".scene").forEach((scene) => {
                  const active =
                    t >= Number(scene.dataset.start) &&
                    t <
                      Number(scene.dataset.start) +
                        Number(scene.dataset.duration);
                  scene.style.visibility = active ? "visible" : "hidden";
                });
              const elements = Array.from(
                document.querySelectorAll("[data-graph-element]"),
              ).map((el) => ({
                id: el.dataset.graphElement,
                transform: el.style.transform,
                opacity: el.style.opacity,
                text: el.textContent,
                overflow:
                  el.scrollWidth > el.clientWidth + 2 ||
                  el.scrollHeight > el.clientHeight + 2,
              }));
              return {
                elements,
                scenes: Array.from(document.querySelectorAll(".scene")).map(
                  (scene) => ({
                    id: scene.dataset.sceneId,
                    visibility: getComputedStyle(scene).visibility,
                    handoff: getComputedStyle(
                      scene.querySelector(".scene-handoff"),
                    ).opacity,
                  }),
                ),
              };
            }, time),
          );
          if ([0.6, 1.5, 2.8].includes(time))
            await page.screenshot({
              path: path.join(root, `${orientation}-${mode}-${time}.png`),
            });
        }
        assert.deepEqual(
          states[0],
          states.at(-1),
          "backward seek must restore state",
        );
        assert.notEqual(
          states[1].elements[0].transform,
          states[3].elements[0].transform,
          "continuous motion through final hold",
        );
        assert.ok(
          states.every((state) => state.elements.every((el) => !el.overflow)),
          "copy must fit",
        );
        assert.equal(Number(states[1].elements[1].opacity), 1);
        assert.equal(states[1].scenes[1].visibility, "hidden");
        assert.equal(states[5].scenes[0].visibility, "hidden");
        assert.equal(states[5].scenes[1].visibility, "visible");
        modes[mode] = states;
      }
      assert.deepEqual(
        modes.preview,
        modes.producer,
        "preview/export native seeks agree",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      report.push({ orientation, modes, errors, external });
    } finally {
      await page.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
    const project = path.join(root, orientation);
    await mkdir(project, { recursive: true });
    await copyHyperframesRuntime(path.join(project, "_runtime"));
    await writeFile(path.join(project, "index.html"), producer);
    if (!process.argv.includes("--preview-only")) {
      const output = path.join(root, `${orientation}.mp4`);
      await new Promise((resolve, reject) => {
        const worker = spawn(
          process.execPath,
          [
            "scripts/hyperframes-render-worker.mjs",
            project,
            output,
            "30",
            "draft",
          ],
          { stdio: "inherit" },
        );
        worker.once("error", reject);
        worker.once("exit", (code) =>
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
      assert.ok(Math.abs(Number(probe.format.duration) - 5) < 0.1);
      report.at(-1).export = {
        probe,
        sha256: createHash("sha256")
          .update(await readFile(output))
          .digest("hex"),
      };
      for (const time of [0.6, 1.5, 2.8, 3.3, 4])
        execFileSync(
          "ffmpeg",
          [
            "-y",
            "-ss",
            String(time),
            "-i",
            output,
            "-frames:v",
            "1",
            path.join(root, `${orientation}-export-${time}.png`),
          ],
          { stdio: "ignore" },
        );
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(root, "report.json"),
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      exportExecuted: !process.argv.includes("--preview-only"),
      cases: report,
    },
    null,
    2,
  ),
);
console.log(
  process.argv.includes("--preview-only")
    ? "Motion graph offline preview/native seeks and repeated seeks verified; exports skipped."
    : "Motion graph offline preview/native seeks, repeated seeks and actual exports verified.",
);
