/** M11: authored contact sheets, native seek parity and isolated actual exports. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { MOTION_RECIPES } from "../src/production/motion.ts";
import { motionLibraryFixture } from "../tests/fixtures/motion-library.ts";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const root = path.resolve(".artifacts/m11-motion-library");
await mkdir(root, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
});
const report = {
  verifiedAt: new Date().toISOString(),
  exportsExecuted: !process.argv.includes("--preview-only"),
  cases: [],
};
const product = await browser.newPage();
await product.setViewport({ width: 960, height: 540 });
await product.setContent(
  `<style>body{margin:0;background:#10131d;color:#f5f6fa;font:24px system-ui;padding:36px;box-sizing:border-box}header{display:flex;justify-content:space-between;padding-bottom:28px;border-bottom:1px solid #41485e}main{display:grid;grid-template-columns:1fr 1.8fr;gap:24px;padding-top:28px}.panel{background:#1b2233;border:1px solid #41485e;border-radius:16px;padding:24px}.frame{height:210px;background:linear-gradient(135deg,#ff5a5f,#5a3470);display:grid;place-items:center;border-radius:12px;font-size:40px;font-weight:800}.line{height:12px;border-radius:6px;background:#495675;margin:18px 0}.timeline{display:flex;gap:8px;margin-top:24px}.beat{height:44px;flex:1;background:#ff5a5f;border-radius:7px}.beat:nth-child(2){background:#2bb5a8}.beat:nth-child(3){background:#8258ca}small{font-size:16px;color:#b6c1d8}</style><header><b>STORY STUDIO</b><small>Product verification fixture</small></header><main><div class="panel"><b>Scene editor</b><div class="line"></div><div class="line" style="width:72%"></div><div class="line" style="width:86%"></div><small>Copy · timing · design</small></div><div class="panel"><div class="frame">A clear idea.</div><div class="timeline"><div class="beat"></div><div class="beat"></div><div class="beat"></div></div></div></main>`,
);
await product.screenshot({
  path: path.join(root, "fixture.jpg"),
  type: "jpeg",
  quality: 92,
});
await product.close();
report.mediaFixture = {
  kind: "deterministic product UI",
  license: "MIT",
  sha256: createHash("sha256")
    .update(await readFile(path.join(root, "fixture.jpg")))
    .digest("hex"),
};
try {
  const orientations = [
    ["portrait", 540, 960],
    ["landscape", 960, 540],
    ["square", 540, 540],
  ];
  const requestedOrientation = process.argv
    .find((arg) => arg.startsWith("--orientation="))
    ?.split("=")[1];
  if (requestedOrientation)
    assert.ok(
      orientations.some(([id]) => id === requestedOrientation),
      "Unknown orientation",
    );
  for (const [orientation, width, height] of orientations.filter(
    ([id]) => !requestedOrientation || id === requestedOrientation,
  )) {
    const props = motionLibraryFixture(width, height);
    const light = {
      ...props,
      tokens: {
        ...props.tokens,
        background: "#f5f1e8",
        foreground: "#182131",
        muted: "#556174",
        accent: "#2868b2",
        accentSecondary: "#749a32",
        accentForeground: "#ffffff",
      },
    };
    const stress = {
      ...props,
      scenes: props.scenes.map((scene, index) => {
        // Adaptive admission ceilings can deliberately fall back at extreme
        // density. Their boundary cases are covered by adaptive-layout tests.
        if (index < 16 || scene.motion.recipeId.startsWith("adaptive-"))
          return scene;
        const recipe = MOTION_RECIPES.find(
          (recipe) => recipe.id === scene.motion.recipeId,
        );
        const text =
          "Thoughtful design keeps a useful message clear and gives every complete idea enough space to read. "
            .repeat(3)
            .slice(0, recipe.maxCharacters);
        const items = scene.items
          ? Array.from({ length: recipe.id === "list-grid" ? 4 : 5 }, (_, i) =>
              `${i + 1}. Supplied idea with enough detail to check a complete phrase`.slice(
                0,
                60,
              ),
            )
          : undefined;
        const chart = scene.chart
          ? {
              labels: Array.from(
                { length: 6 },
                (_, i) => `Supplied result number ${i + 1}`,
              ),
              series: [
                {
                  label: "Illustrative verification data",
                  values: [0, 18.125, 42, 68, 91, 100],
                  unit: "%",
                },
              ],
              sourceAttribution:
                "Verification fixture only. These supplied values illustrate text fit and are not a real-world claim or benchmark.",
            }
          : undefined;
        return { ...scene, text, items, chart, emphasis: [] };
      }),
    };
    const htmls = {
      preview: buildHyperframesCompositionHtml(props),
      producer: buildHyperframesCompositionHtml(props, {
        producerMode: true,
        runtimeUrl: "/_runtime/gsap.min.js",
      }),
      light: buildHyperframesCompositionHtml(light),
      stress: buildHyperframesCompositionHtml(stress),
    };
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      try {
        if (pathname === "/favicon.ico") res.writeHead(204).end();
        else if (pathname === "/producer")
          res
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .end(htmls.producer);
        else if (
          pathname === "/preview" ||
          pathname === "/light" ||
          pathname === "/stress"
        )
          res
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .end(
              `<style>body{margin:0}</style><iframe style="width:${width}px;height:${height}px;border:0"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(htmls[pathname.slice(1)]).replaceAll("<", "\\u003c")}</script>`,
            );
        else if (pathname === "/fixture.jpg")
          res
            .setHeader("Content-Type", "image/jpeg")
            .end(await readFile(path.join(root, "fixture.jpg")));
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
      external = [],
      failed = [];
    await page.setViewport({ width, height });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 400) failed.push(res.url());
    });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) {
        external.push(req.url());
        req.abort();
      } else req.continue();
    });
    const states = {},
      thumbs = [];
    try {
      for (const mode of ["preview", "producer", "light", "stress"]) {
        const expectedProps = mode === "stress" ? stress : props;
        await page.goto(`${base}/${mode}`, { waitUntil: "networkidle0" });
        const frame =
          mode === "producer"
            ? page.mainFrame()
            : page.frames().find((f) => f !== page.mainFrame());
        await frame.evaluate(() => document.fonts.ready);
        states[mode] = [];
        for (const [index, beat] of props.timeline.entries()) {
          const time = beat.startFrame / props.fps + 1.8;
          const state = await frame.evaluate((t) => {
            window.__timelines.reel.seek(t, true);
            if (!window.__reelSeek)
              document.querySelectorAll(".scene").forEach((scene) => {
                scene.style.visibility =
                  t >= Number(scene.dataset.start) &&
                  t <
                    Number(scene.dataset.start) + Number(scene.dataset.duration)
                    ? "visible"
                    : "hidden";
              });
            const scenes = Array.from(document.querySelectorAll(".scene"));
            const scene = scenes
              .filter(
                (scene) => getComputedStyle(scene).visibility === "visible",
              )
              .at(-1);
            const stage = scene.querySelector(".fx-stage");
            const rect = stage.getBoundingClientRect();
            const leaves = Array.from(
              stage.querySelectorAll(
                ".fx-line-inner,.sm-copy,.sm-label,.sm-brand,.dm-value,.dm-row-label,.dm-source,.gm-card,.am-item-copy,.am-cell-label,.am-value,.am-source,.ar-headline,.ar-copy,.ar-label,.ar-evidence strong,.ar-source,svg text",
              ),
            );
            return {
              recipe: scene.dataset.motionRecipe,
              sceneId: scene.dataset.sceneId,
              color: getComputedStyle(stage).color,
              fitWarning: stage.dataset.textFitWarning ?? null,
              ambient: stage.querySelector(".ml-ambient")?.style.transform ?? null,
              leaves: leaves.map((el) => {
                const r = el.getBoundingClientRect();
                const range = document.createRange();
                range.selectNodeContents(el);
                const contentRect = el.namespaceURI.endsWith("svg")
                  ? r
                  : range.getBoundingClientRect();
                let clipped = false;
                for (
                  let parent = el;
                  parent && parent !== stage;
                  parent = parent.parentElement
                ) {
                  const style = getComputedStyle(parent);
                  const box = parent.getBoundingClientRect();
                  if (
                    ["hidden", "clip"].includes(style.overflowX) &&
                    (contentRect.left < box.left - 2 ||
                      contentRect.right > box.right + 2)
                  )
                    clipped = true;
                  if (
                    ["hidden", "clip"].includes(style.overflowY) &&
                    (contentRect.top < box.top - 2 ||
                      contentRect.bottom > box.bottom + 2)
                  )
                    clipped = true;
                }
                return {
                  text: el.textContent.trim(),
                  color: getComputedStyle(el).color,
                  font: getComputedStyle(el).fontFamily,
                  box: [
                    el.clientWidth,
                    el.scrollWidth,
                    el.clientHeight,
                    el.scrollHeight,
                  ],
                  bounds: [
                    contentRect.left,
                    contentRect.top,
                    contentRect.right,
                    contentRect.bottom,
                  ],
                  effectiveOpacity: (() => {
                    let opacity = 1;
                    for (
                      let parent = el;
                      parent;
                      parent = parent.parentElement
                    ) {
                      opacity *= Number(getComputedStyle(parent).opacity);
                      if (parent === stage) break;
                    }
                    return opacity;
                  })(),
                  overflow: clipped,
                  outside:
                    contentRect.left < rect.left - 2 ||
                    contentRect.top < rect.top - 2 ||
                    contentRect.right > rect.right + 2 ||
                    contentRect.bottom > rect.bottom + 2,
                };
              }),
            };
          }, time);
          assert.equal(
            state.recipe,
            props.scenes[index].motion.recipeId,
            "must use the authored block",
          );
          assert.ok(
            state.leaves.every((leaf) => !leaf.overflow && !leaf.outside),
            `${orientation}/${mode}/${state.recipe} copy must fit: ${JSON.stringify(state.leaves)}`,
          );
          const displayed = state.leaves
            .map((leaf) => leaf.text)
            .join(" ")
            .replace(/\s+/g, " ");
          assert.ok(
            displayed.includes(expectedProps.scenes[index].text),
            `${state.recipe} must retain all copy`,
          );
          const ink = (
            mode === "light" ? light : props
          ).tokens.foreground.slice(1);
          const expected = `rgb(${[0, 2, 4].map((offset) => parseInt(ink.slice(offset, offset + 2), 16)).join(", ")})`;
          assert.equal(
            state.color,
            expected,
            `${state.recipe} must propagate brand ink`,
          );
          if (state.recipe === "data-spotlight")
            assert.ok(displayed.includes("72%"));
          if (state.recipe === "data-bars")
            for (const value of ["42%", "68%", "91%"])
              assert.ok(displayed.includes(value));
          if (
            props.scenes[index].id.startsWith("list-") ||
            props.scenes[index].id === "data-ledger"
          ) {
            for (const value of expectedProps.scenes[index].items ??
              expectedProps.scenes[index].chart?.labels ??
              [])
              assert.ok(
                displayed.includes(value),
                `must keep supplied item ${value}`,
              );
          }
          if (state.recipe === "data-ledger")
            for (const value of mode === "stress"
              ? ["0%", "18.125%", "42%", "68%", "91%", "100%"]
              : ["42%", "68%", "91%"])
              assert.ok(displayed.includes(value));
          if (state.recipe === "media-mat")
            assert.equal(
              await frame.$eval(
                ".am-gallery-mat img",
                (el) => getComputedStyle(el).objectFit,
              ),
              "contain",
            );
          if (index >= 16) {
            assert.ok(
              state.leaves.every((leaf) => leaf.effectiveOpacity >= 0.98),
              `${orientation}/${mode}/${state.recipe} text must be fully visible after settling`,
            );
            for (const [i, first] of state.leaves.entries())
              for (const second of state.leaves.slice(i + 1)) {
                const overlapWidth =
                  Math.min(first.bounds[2], second.bounds[2]) -
                  Math.max(first.bounds[0], second.bounds[0]);
                const overlapHeight =
                  Math.min(first.bounds[3], second.bounds[3]) -
                  Math.max(first.bounds[1], second.bounds[1]);
                assert.ok(
                  overlapWidth <= 2 || overlapHeight <= 2,
                  `${orientation}/${mode}/${state.recipe} text must not overlap: ${first.text} / ${second.text}`,
                );
              }
          }
          if (index >= 16 && state.fitWarning) {
            await page.screenshot({
              path: path.join(
                root,
                `${orientation}-${mode}-${state.recipe}-fit-failure.png`,
              ),
            });
            console.log(
              JSON.stringify(
                await frame.evaluate(() =>
                  Array.from(document.querySelectorAll("[data-design-block]"))
                    .filter(
                      (stage) =>
                        getComputedStyle(stage.closest(".scene")).visibility ===
                        "visible",
                    )
                    .map((stage) => {
                      const box = stage.querySelector(
                        ".am-list-content,.am-ledger-content,.am-spread,.am-poster,.am-window",
                      );
                      return {
                        recipe: stage.dataset.recipe,
                        height: box?.clientHeight,
                        children: Array.from(box?.children ?? []).map((el) => [
                          el.className,
                          el.offsetHeight,
                        ]),
                        text: Array.from(
                          stage.querySelectorAll(
                            ".fx-line-inner,.am-item-copy,.am-source",
                          ),
                        ).map((el) => [
                          el.textContent,
                          el.clientWidth,
                          el.scrollWidth,
                          getComputedStyle(el).fontSize,
                        ]),
                      };
                    }),
                ),
                null,
                2,
              ),
            );
          }
          if (index >= 16)
            assert.equal(
              state.fitWarning,
              null,
              `${orientation}/${mode}/${state.recipe} must fit at readable sizes`,
            );
          const seekState = async (t) =>
            frame.evaluate((time) => {
              window.__timelines.reel.seek(time, true);
              return Array.from(
                document.querySelectorAll("[data-design-block] *,[data-adaptive] *"),
              ).map((el) => [el.style.transform, el.style.opacity]);
            }, t);
          if (index >= 16) {
            const settled = await seekState(time);
            const entrance = await seekState(beat.startFrame / props.fps + 0.1);
            assert.notDeepEqual(
              settled,
              entrance,
              `${state.recipe} must animate`,
            );
            assert.deepEqual(
              await seekState(time),
              settled,
              `${state.recipe} must restore on reverse seek`,
            );
          }
          states[mode].push(state);
          if (mode !== "producer") {
            const name = `${orientation}-${mode}-${state.recipe}.png`;
            await page.screenshot({ path: path.join(root, name) });
            if (mode === "preview") thumbs.push({ name, recipe: state.recipe });
          }
        }
        const last =
          props.timeline.find((beat) => beat.sceneId === "quote-margin")
            .startFrame / props.fps;
        const handoff = await frame.evaluate(() => {
          window.__timelines.reel.seek(3.3, true);
          const plate = document.querySelector(
            '[data-scene-id="type-impact"] .ml-backplate',
          );
          return {
            opacity: getComputedStyle(plate).opacity,
            background: getComputedStyle(plate).backgroundColor,
          };
        });
        assert.equal(
          handoff.opacity,
          "1",
          "incoming plate must separate overlapping headlines",
        );
        assert.notEqual(handoff.background, "rgba(0, 0, 0, 0)");
        const motionStates = [];
        for (const local of [8, 9.5, 8])
          motionStates.push(
            await frame.evaluate((t) => {
              window.__timelines.reel.seek(t, true);
              return document.querySelector(
                '[data-scene-id="quote-margin"] .ml-ambient',
              ).style.transform;
            }, last + local),
          );
        assert.notEqual(
          motionStates[0],
          motionStates[1],
          "ambient continues in a long reading hold",
        );
        assert.equal(
          motionStates[0],
          motionStates[2],
          "backward seek restores ambient",
        );
      }
      assert.deepEqual(
        states.preview,
        states.producer,
        "preview and producer native seeks must match",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      assert.deepEqual(failed, []);
      const thumbWidth = orientation === "landscape" ? 320 : 216;
      const cards = [];
      for (const thumb of thumbs)
        cards.push(
          `<div><img width="${thumbWidth}" src="data:image/png;base64,${(await readFile(path.join(root, thumb.name))).toString("base64")}"><p>${thumb.recipe}</p></div>`,
        );
      await page.setViewport({
        width: thumbWidth * 3 + 48,
        height:
          Math.ceil(thumbs.length / 3) * ((thumbWidth * height) / width + 38) +
          48,
      });
      await page.setContent(
        `<style>body{margin:16px;background:#12131a;color:#eee;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}p{margin:4px 0 12px}img{display:block}</style><div class="grid">${cards.join("")}</div>`,
      );
      await page.screenshot({
        path: path.join(root, `${orientation}-contact-sheet.png`),
        fullPage: true,
      });
      report.cases.push({ orientation, states, errors, external, failed });
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
    await copyFile(
      path.join(root, "fixture.jpg"),
      path.join(project, "fixture.jpg"),
    );
    await writeFile(path.join(project, "index.html"), htmls.producer);
    if (!process.argv.includes("--preview-only")) {
      const output = path.join(root, `${orientation}.mp4`);
      await new Promise((resolve, reject) => {
        const worker = spawn(
          process.execPath,
          [
            "scripts/hyperframes-render-worker.mjs",
            project,
            output,
            String(props.fps),
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
      const endpoint =
        Math.max(
          ...props.timeline.map(
            (beat) => beat.startFrame + beat.durationFrames,
          ),
        ) / props.fps;
      assert.ok(
        Math.abs(Number(probe.format.duration) - endpoint) < 0.1,
        `All ${props.scenes.length} treatments must export through the final hold (${endpoint}s).`,
      );
      report.cases.at(-1).export = {
        probe,
        sha256: createHash("sha256")
          .update(await readFile(output))
          .digest("hex"),
      };
      for (const [index, beat] of props.timeline.entries())
        execFileSync(
          "ffmpeg",
          [
            "-y",
            "-ss",
            String(beat.startFrame / props.fps + 1.8),
            "-i",
            output,
            "-frames:v",
            "1",
            path.join(
              root,
              `${orientation}-export-${props.scenes[index].id}.png`,
            ),
          ],
          { stdio: "ignore" },
        );
      for (const time of [2.95, 3.3, 50, 51.5])
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
  JSON.stringify(report, null, 2),
);
console.log(
  report.exportsExecuted
    ? "Authored contact sheets, seek parity, supplied data, brand propagation and actual exports verified."
    : "Authored contact sheets and seek parity verified; exports skipped.",
);
