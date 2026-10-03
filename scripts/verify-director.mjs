/** Real no-key directed copy/data, offline seeks and isolated worker exports. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { directorFixture } from "../tests/fixtures/director.ts";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer")));
const root = path.resolve(".artifacts/m12-director");
await mkdir(root, { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: process.env.REEL_VERIFY_CHROME || await puppeteer.executablePath() });
const cases = [];
try {
  for (const [orientation, width, height] of [["portrait", 540, 960], ["landscape", 960, 540]]) {
    const props = directorFixture(width, height);
    assert.deepEqual(props.scenes.map((scene) => scene.role), ["metric", "chart", "diagram", "quote", "comparison"]);
    assert.deepEqual(props.scenes[1].chart.series[0].values, [42, 57]);
    const preview = buildHyperframesCompositionHtml(props);
    const producer = buildHyperframesCompositionHtml(props, { producerMode: true, runtimeUrl: "/_runtime/gsap.min.js" });
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      try {
        if (pathname === "/favicon.ico") res.writeHead(204).end();
        else if (pathname === "/preview") res.setHeader("Content-Type", "text/html").end(
          `<meta charset="utf-8"><style>body{margin:0}</style><iframe id="preview" style="width:${width}px;height:${height}px;border:0"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(preview).replaceAll("<", "\\u003c")}</script>`);
        else if (pathname === "/producer") res.setHeader("Content-Type", "text/html").end(producer);
        else res.setHeader("Content-Type", pathname.endsWith(".js") ? "text/javascript" : "font/woff2")
          .end(await readFile(path.resolve("public/reel-runtime", path.basename(pathname))));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    const errors = [], external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width, height });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) { external.push(req.url()); req.abort(); }
      else req.continue();
    });
    const modes = {};
    try {
      for (const mode of ["preview", "producer"]) {
        await page.goto(`${base}/${mode}`, { waitUntil: "networkidle0" });
        const frame = mode === "preview" ? page.frames().find((value) => value !== page.mainFrame()) : page.mainFrame();
        await frame.evaluate(() => document.fonts.ready);
        const states = [];
        for (const time of [1.8, 5.8, 9.8, 12.1, 13.8, 17.8, 13.8]) {
          states.push(await frame.evaluate((time) => {
            window.__timelines.reel.seek(time, true);
            if (!window.__reelSeek) document.querySelectorAll(".scene").forEach((scene) => {
              scene.style.visibility = time >= Number(scene.dataset.start) && time < Number(scene.dataset.start) + Number(scene.dataset.duration) ? "visible" : "hidden";
            });
            const scene = Array.from(document.querySelectorAll(".scene")).findLast((scene) => getComputedStyle(scene).visibility === "visible");
            const graph = scene.querySelector("[data-graph-text]");
            const range = graph && document.createRange();
            if (range) range.selectNodeContents(graph);
            const box = graph?.getBoundingClientRect(), ink = range?.getBoundingClientRect();
            return { id: scene.dataset.sceneId, text: scene.textContent.replace(/\s+/g, " ").trim(),
              graph: graph && { opacity: graph.style.opacity, font: getComputedStyle(graph).fontSize,
                fits: ink.width <= box.width + 1 && ink.height <= box.height + 1 } };
          }, time));
          if ([1.8, 5.8, 9.8, 13.8, 17.8].includes(time)) await page.screenshot({ path: path.join(root, `${orientation}-${mode}-${time}.png`) });
        }
        assert.ok(states[0].text.includes("42%") && !states[0].text.includes("0%"), "the supplied metric is exact during a seek");
        assert.ok(states[1].text.includes("42") && states[1].text.includes("57"));
        for (const word of ["Capture", "Review", "Export"]) assert.ok(states[2].text.includes(word));
        assert.equal(Number(states[3].graph.opacity), 0, "wait for the measured first word");
        assert.equal(Number(states[4].graph.opacity), 1); assert.equal(states[4].graph.fits, true);
        assert.ok(states[4].text.includes("Keep every supplied word."));
        assert.ok(states[5].text.includes("Manual editing") && states[5].text.includes("guided creation"));
        assert.deepEqual(states[4], states[6], "backward seek is deterministic");
        modes[mode] = states;
      }
      assert.deepEqual(modes.preview, modes.producer, "preview/native producer poses agree");
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
    } finally {
      await page.close(); await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    }
    const project = path.join(root, orientation);
    await mkdir(project, { recursive: true });
    await copyHyperframesRuntime(path.join(project, "_runtime"));
    await writeFile(path.join(project, "index.html"), producer);
    const result = { orientation, roles: props.scenes.map((scene) => scene.role), modes, errors, external };
    if (!process.argv.includes("--preview-only")) {
      const output = path.join(root, `${orientation}.mp4`);
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["scripts/hyperframes-render-worker.mjs", project, output, "30", "draft"], { stdio: "inherit" });
        child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Export failed: ${code}`)));
      });
      const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", output], { encoding: "utf8" }));
      assert.equal(probe.streams[0].width, width); assert.equal(probe.streams[0].height, height);
      assert.ok(Math.abs(Number(probe.format.duration) - 20) < .1);
      result.export = { probe, sha256: createHash("sha256").update(await readFile(output)).digest("hex") };
      for (const time of [1.8, 5.8, 9.8, 12.1, 13.8, 16.3, 17.8]) execFileSync("ffmpeg", ["-y", "-ss", String(time), "-i", output, "-frames:v", "1", path.join(root, `${orientation}-export-${time}.png`)], { stdio: "ignore" });
    }
    cases.push(result);
  }
} finally { await browser.close(); }
await writeFile(path.join(root, "report.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), exportsExecuted: !process.argv.includes("--preview-only"), paidCalls: 0, cases }, null, 2));
console.log(process.argv.includes("--preview-only") ? "Director offline preview/native probes passed; exports skipped." : "Director preview/native probes and actual portrait/landscape exports passed.");
