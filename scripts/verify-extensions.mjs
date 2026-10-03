/** M14: real registered block, offline native seeks and isolated MP4s. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
import { defaultBrandTokens } from "../src/video/tokens.ts";
import { motionDirection } from "../src/production/motion.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const root = path.resolve(".artifacts/m14-extensions");
await mkdir(root, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
});
const report = {
  verifiedAt: new Date().toISOString(),
  paidCalls: 0,
  exportsExecuted: true,
  cases: [],
};
try {
  for (const [orientation, width, height] of [
    ["portrait", 540, 960],
    ["landscape", 960, 540],
    ["square", 720, 720],
  ]) {
    const props = {
      width,
      height,
      fps: 30,
      tokens: defaultBrandTokens,
      scenes: [
        {
          id: "quote",
          templateId: "hf-quote",
          text: "Build around one clear message. Give every word room to breathe, preserve the supplied meaning, and let motion support the story.",
          emphasis: [],
          role: "quote",
          motion: motionDirection("quote-margin"),
        },
      ],
      timeline: [{ sceneId: "quote", startFrame: 0, durationFrames: 120 }],
    };
    const preview = buildHyperframesCompositionHtml(props);
    const producer = buildHyperframesCompositionHtml(props, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
    });
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      try {
        if (pathname === "/favicon.ico") res.writeHead(204).end();
        else if (pathname === "/preview" || pathname === "/producer")
          res
            .setHeader("Content-Type", "text/html")
            .end(pathname === "/preview" ? preview : producer);
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
    await page.setViewport({ width, height });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) {
        external.push(req.url());
        req.abort();
      } else req.continue();
    });
    const modes = {};
    try {
      for (const mode of ["preview", "producer"]) {
        await page.goto(`${base}/${mode}`, { waitUntil: "networkidle0" });
        await page.evaluate(() => document.fonts.ready);
        const states = [];
        for (const time of [0.1, 1.5, 3.2, 0.1]) {
          states.push(
            await page.evaluate((t) => {
              window.__timelines.reel.seek(t, true);
              return Array.from(
                document.querySelectorAll(
                  ".qm-copy .fx-line-inner,.qm-mark,.qm-rule",
                ),
              ).map((el) => {
                const rect = el.getBoundingClientRect();
                return {
                  text: el.textContent,
                  className: el.className,
                  display: getComputedStyle(el).display,
                  fontSize: getComputedStyle(el).fontSize,
                  lineHeight: getComputedStyle(el).lineHeight,
                  client: [el.clientWidth, el.clientHeight],
                  scroll: [el.scrollWidth, el.scrollHeight],
                  transform: el.style.transform,
                  opacity: el.style.opacity,
                  overflow:
                    el.scrollWidth > el.clientWidth + 2 ||
                    el.scrollHeight > el.clientHeight + 2,
                  inFrame:
                    rect.left >= -2 &&
                    rect.right <= innerWidth + 2 &&
                    rect.top >= -2 &&
                    rect.bottom <= innerHeight + 2,
                };
              });
            }, time),
          );
          if (time === 1.5)
            await page.screenshot({
              path: path.join(root, `${orientation}-${mode}.png`),
            });
        }
        assert.deepEqual(
          states[0],
          states.at(-1),
          "backward seek restores state",
        );
        assert.ok(
          states[1].some((state) => state.text === props.scenes[0].text),
        );
        await writeFile(
          path.join(root, `${orientation}-${mode}-states.json`),
          JSON.stringify(states, null, 2),
        );
        assert.ok(
          states[1].every((state) => state.inFrame && !state.overflow),
          "settled copy and decoration fit",
        );
        modes[mode] = states;
      }
      assert.deepEqual(
        modes.preview,
        modes.producer,
        "native preview/export parity",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await page.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    const project = path.join(root, orientation);
    await mkdir(project, { recursive: true });
    await copyHyperframesRuntime(path.join(project, "_runtime"));
    await writeFile(path.join(project, "index.html"), producer);
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
        {
          stdio: "inherit",
          env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
        },
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
    assert.ok(Math.abs(Number(probe.format.duration) - 4) < 0.1);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        "1.5",
        "-i",
        output,
        "-frames:v",
        "1",
        path.join(root, `${orientation}-export.png`),
      ],
      { stdio: "ignore" },
    );
    report.cases.push({
      orientation,
      width,
      height,
      modes,
      errors,
      external,
      probe,
      sha256: createHash("sha256")
        .update(await readFile(output))
        .digest("hex"),
    });
  }
  await writeFile(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
