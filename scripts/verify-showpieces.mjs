/** Offline frame-by-frame story choreography, seek parity and real audio exports. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { SHOWPIECE_STRESS } from "../tests/fixtures/showpiece-stress.ts";
import { SHOWPIECE_SAMPLES } from "../src/video/showpiece-samples.ts";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { copyHyperframesRuntime } from "../src/library/hyperframes-runtime.ts";
import {
  applyVisualTheme,
  VISUAL_THEMES,
} from "../src/production/creative-direction.ts";
import { defaultBrandTokens } from "../src/video/tokens.ts";
import { buildAutomaticSfxCues } from "../src/lib/sfx-planner.ts";
import { resolveReelSfxCues } from "../src/lib/sfx-cues.ts";
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const selected = process.argv
  .find((arg) => arg.startsWith("--showpiece="))
  ?.split("=")[1];
const dense = process.argv.includes("--stress");
const atmosphere = process.argv.includes("--atmosphere");
const selectedScenes = atmosphere
  ? [
      SHOWPIECE_SAMPLES[6],
      {
        id: "celestial-type",
        templateId: "hf-statement",
        text: "Find your rhythm in 2027.",
        emphasis: [],
        motion: { recipeId: "type-window", version: "1.0.0" },
      },
    ]
  : dense
    ? [SHOWPIECE_STRESS]
    : selected
      ? SHOWPIECE_SAMPLES.filter(
          (scene) => scene.direction.graphic.presentation === selected,
        )
      : SHOWPIECE_SAMPLES;
assert.ok(selectedScenes.length, "Unknown showpiece filter");
const root = path.resolve(
  atmosphere
    ? ".artifacts/story-showpieces/matrix-atmosphere"
    : dense
      ? ".artifacts/story-showpieces/matrix-stress"
      : selected
        ? `.artifacts/story-showpieces/matrix-${selected}`
        : ".artifacts/story-showpieces/matrix",
);
await mkdir(root, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
});
const reports = [];
try {
  for (const [orientation, width, height] of [
    ["portrait", 540, 960],
    ["landscape", 960, 540],
    ["square", 540, 540],
  ]) {
    const scenes = selectedScenes.map((s) => ({ ...s }));
    const timeline = scenes.map((s, i) => ({
      sceneId: s.id,
      startFrame: i * 192,
      durationFrames: 192,
    }));
    const dto = scenes.map((s, i) => ({
      ...s,
      scriptId: "fixture",
      order: i,
      spokenText: s.spokenText ?? null,
      hideText: null,
      selectedVoiceClipId: null,
    }));
    const sfxCues = resolveReelSfxCues({
      sfxEnabled: true,
      sfxJson: JSON.stringify({
        enabled: true,
        cues: buildAutomaticSfxCues(dto),
      }),
      timeline,
      scenes: dto,
      fps: 24,
      videoEngine: "hyperframes",
    }).map((c) => ({ ...c, url: c.url.replace(/^\//, "") }));
    assert.ok(
      sfxCues.length >= scenes.length,
      "Defaults must yield sound accents across the film",
    );
    const props = {
      scenes,
      timeline,
      width,
      height,
      fps: 24,
      tokens: applyVisualTheme(
        defaultBrandTokens,
        atmosphere ||
          selectedScenes.every((scene) =>
            ["lunar-cycle", "year-cycle", "sky-orbit"].includes(
              scene.direction.graphic.presentation,
            ),
          )
          ? VISUAL_THEMES.celestial
          : VISUAL_THEMES.circuit,
      ),
      hideProgressBar: true,
      sfxCues,
      musicUrl: "music/tech-minimal.wav",
      musicVolume: 6,
    };
    const preview = buildHyperframesCompositionHtml({
      ...props,
      sfxCues: sfxCues.map((c) => ({ ...c, url: "/" + c.url })),
      musicUrl: "/music/tech-minimal.wav",
    });
    const producer = buildHyperframesCompositionHtml(props, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
    });
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost").pathname;
      try {
        if (url === "/favicon.ico") res.writeHead(204).end();
        else if (url === "/preview")
          res
            .setHeader("Content-Type", "text/html")
            .end(
              `<style>body{margin:0}</style><iframe style="width:${width}px;height:${height}px;border:0"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(preview).replaceAll("<", "\\u003c")}</script>`,
            );
        else if (url === "/producer")
          res.setHeader("Content-Type", "text/html").end(producer);
        else {
          const file = /^\/(sfx|music)\//.test(url)
            ? path.join("public", url)
            : path.join("public/reel-runtime", path.basename(url));
          res
            .setHeader(
              "Content-Type",
              url.endsWith(".js")
                ? "text/javascript"
                : url.endsWith(".wav")
                  ? "audio/wav"
                  : "font/woff2",
            )
            .end(await readFile(file));
        }
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    const errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(e.message));
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
        const frame =
          mode === "preview"
            ? page.frames().find((f) => f !== page.mainFrame())
            : page.mainFrame();
        await frame.evaluate(() => document.fonts.ready);
        const sample = async (time) =>
          frame.evaluate((time) => {
            window.__timelines.reel.seek(time, true);
            if (!window.__reelSeek)
              document
                .querySelectorAll(".scene")
                .forEach(
                  (s) =>
                    (s.style.visibility =
                      time >= Number(s.dataset.start) &&
                      time <
                        Number(s.dataset.start) + Number(s.dataset.duration)
                        ? "visible"
                        : "hidden"),
                );
            const scene = [...document.querySelectorAll(".scene")].findLast(
              (s) => getComputedStyle(s).visibility === "visible",
            );
            const stage = scene.querySelector("[data-showpiece],.fx-stage");
            const box = stage.getBoundingClientRect();
            const text = [
              ...stage.querySelectorAll(
                ".sp-headline,.sp-label,.sp-detail,.sp-snapshot,.cy-eyebrow,.cy-disclosure,.am-copy",
              ),
            ].flatMap((el) => {
              let opacity = 1;
              for (let p = el; p && p !== scene; p = p.parentElement)
                opacity *= Number(getComputedStyle(p).opacity);
              if (opacity < 0.95) return [];
              const range = document.createRange();
              range.selectNodeContents(el);
              const r = range.getBoundingClientRect();
              const face = el
                .closest(".sp-node-face,.sp-screen,.sp-snapshots")
                ?.getBoundingClientRect();
              return [
                {
                  copy: el.textContent,
                  font: parseFloat(getComputedStyle(el).fontSize),
                  bounds: [r.left, r.top, r.right, r.bottom].map(
                    (n) => Math.round(n * 1000) / 1000,
                  ),
                  outside:
                    r.left < box.left - 2 ||
                    r.right > box.right + 2 ||
                    r.top < box.top - 2 ||
                    r.bottom > box.bottom + 2,
                  spill:
                    face &&
                    (r.left < face.left - 2 ||
                      r.right > face.right + 2 ||
                      r.top < face.top - 2 ||
                      r.bottom > face.bottom + 2),
                },
              ];
            });
            return {
              id: scene.dataset.sceneId,
              kind: stage.dataset.showpiece,
              text,
              pose: [
                ...stage.querySelectorAll(
                  ".sp-camera,.sp-node,.sp-screen-state,.sp-packet,.cy-orrery,.cy-phase,.cy-wheel,.cy-constellation,.cy-satellite,.cy-star,.cs-sky",
                ),
              ].map((el) => [el.style.transform, el.style.opacity]),
            };
          }, time);
        const states = [];
        for (const [i, scene] of scenes.entries()) {
          const samples = [];
          for (const offset of [0.3, 2.4, 5.8, 7.1]) {
            const state = await sample(i * 8 + offset);
            try {
              assert.equal(state.id, scene.id);
              assert.ok(
                state.text.every((t) => !t.outside && !t.spill && t.font >= 22),
                `${orientation} ${scene.id} ${offset}: ${JSON.stringify(state.text)}`,
              );
              for (let a = 0; a < state.text.length; a++)
                for (let b = a + 1; b < state.text.length; b++) {
                  const p = state.text[a].bounds,
                    q = state.text[b].bounds;
                  assert.ok(
                    Math.min(p[2], q[2]) - Math.max(p[0], q[0]) <= 2 ||
                      Math.min(p[3], q[3]) - Math.max(p[1], q[1]) <= 2,
                    `${orientation} ${scene.id}: overlapping labels`,
                  );
                }
            } catch (error) {
              await page.screenshot({
                path: path.join(root, `${orientation}-failure.png`),
              });
              throw error;
            }
            if (offset >= 2.4)
              assert.ok(
                state.text.some((item) => item.copy === scene.text),
                "The complete headline must remain visible",
              );
            samples.push(state);
            if (offset === 7.1)
              await page.screenshot({
                path: path.join(root, `${orientation}-${mode}-${scene.id}.png`),
              });
          }
          assert.notDeepEqual(
            samples[1].pose,
            samples[2].pose,
            "The action must continue through the beat",
          );
          await sample(i * 8 + 7.4);
          assert.deepEqual(
            await sample(i * 8 + 2.4),
            samples[1],
            "Reverse seeks must restore pose",
          );
          states.push(samples);
        }
        modes[mode] = states;
      }
      assert.deepEqual(
        modes.preview,
        modes.producer,
        "Preview/producer must share every sampled pose",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await page.close();
      await new Promise((r) => {
        server.close(r);
        server.closeAllConnections();
      });
    }
    const report = { orientation, modes, sfxCues, errors, external };
    if (!process.argv.includes("--preview-only")) {
      const project = path.join(root, orientation);
      await mkdir(project, { recursive: true });
      await copyHyperframesRuntime(path.join(project, "_runtime"));
      await mkdir(path.join(project, "sfx"), { recursive: true });
      await mkdir(path.join(project, "music"), { recursive: true });
      for (const clip of new Set(sfxCues.map((c) => c.url)))
        await copyFile(path.join("public", clip), path.join(project, clip));
      await copyFile(
        "public/music/tech-minimal.wav",
        path.join(project, "music/tech-minimal.wav"),
      );
      await writeFile(path.join(project, "index.html"), producer);
      const output = path.join(root, `${orientation}.mp4`);
      await new Promise((r, j) => {
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
        child.on("error", j);
        child.on("exit", (code) =>
          code === 0 ? r() : j(Error(`Worker failed ${code}`)),
        );
      });
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,codec_name,width,height",
            "-of",
            "json",
            output,
          ],
          { encoding: "utf8" },
        ),
      );
      assert.equal(Number(probe.format.duration), scenes.length * 8);
      const v = probe.streams.find((s) => s.codec_type === "video");
      assert.equal(v.width, width);
      assert.equal(v.height, height);
      assert.ok(probe.streams.some((s) => s.codec_type === "audio"));
      const pcm = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          output,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "48000",
          "-f",
          "f32le",
          "pipe:1",
        ],
        { maxBuffer: 15_000_000 },
      );
      let power = 0,
        peak = 0;
      for (let i = 0; i < pcm.length; i += 4) {
        const value = pcm.readFloatLE(i);
        assert.ok(Number.isFinite(value));
        power += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      assert.ok(
        power > 1 && peak < 1,
        "Decoded soundtrack must be audible and unclipped",
      );
      report.export = {
        probe,
        sha256: createHash("sha256")
          .update(await readFile(output))
          .digest("hex"),
        audio: { rms: Math.sqrt(power / (pcm.length / 4)), peak },
      };
      for (const [i, scene] of scenes.entries())
        for (const [name, offset] of [
          ["early", 0.3],
          ["action", 2.4],
          ["resolve", 7.1],
        ])
          execFileSync(
            "ffmpeg",
            [
              "-y",
              "-ss",
              String(i * 8 + offset),
              "-i",
              output,
              "-frames:v",
              "1",
              path.join(root, `${orientation}-export-${scene.id}-${name}.png`),
            ],
            { stdio: "ignore" },
          );
    }
    reports.push(report);
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(root, "report.json"),
    JSON.stringify(
      { exportsExecuted: !process.argv.includes("--preview-only"), reports },
      null,
      2,
    ),
  );
}
console.log(
  "Story motion, measured-copy bounds, ongoing action, seek parity and audio exports passed.",
);
