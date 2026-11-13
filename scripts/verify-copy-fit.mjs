/**
 * Copy fitting check (roadmap S4): on-screen text is fitted, never cut.
 * Renders 30 headlines of 3-18 words in each format in the real browser and
 * asserts every headline is complete and inside the frame. Also checks the
 * deterministic planner never emits an ellipsis or a mid-clause cut.
 *
 *   npm run test:copy-fit [-- --out <dir>]   writes screenshots and contact sheets
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { defaultBrandTokens } from "../src/video/tokens.ts";
import { createDeterministicProductionPlan } from "../src/production/manual-planner.ts";

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const outIndex = process.argv.indexOf("--out");
const outDir = path.resolve(
  outIndex >= 0 ? process.argv[outIndex + 1] : ".artifacts/copy-fit",
);
await mkdir(outDir, { recursive: true });

const BANK =
  "most people never notice how small habits shape the whole day because the effect builds quietly over weeks and months until the change feels obvious and lasting".split(
    " ",
  );
const REAL = [
  "Sleep is a skill",
  "73% of adults sleep under 7 hours",
  "A strong explainer begins with one clear idea and a promise to the viewer",
  "Save $2,400 a year by changing one 10 minute habit before breakfast every single day",
  "Stop scrolling",
  "The first three seconds decide whether anyone stays to watch the rest of it",
];
function headlines() {
  const list = [...REAL];
  for (let n = 3; list.length < 30; n = n >= 18 ? 3 : n + 1) {
    const start = (list.length * 7) % 12;
    const words = BANK.slice(start, start + n);
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    list.push(words.join(" "));
  }
  return list;
}
const FORMATS = [
  ["portrait", 540, 960],
  ["landscape", 960, 540],
  ["square", 720, 720],
];
const TEMPLATES = [
  ["hf-opener", ".fx-dialogue"],
  ["hf-statement", ".fx-dialogue"],
];
const norm = (t) => t.replace(/\s+/g, " ").trim();

function html(templateId, text, width, height, producer) {
  const props = {
    width,
    height,
    fps: 30,
    tokens: defaultBrandTokens,
    scenes: [{ id: "s", templateId, text, emphasis: [] }],
    timeline: [{ sceneId: "s", startFrame: 0, durationFrames: 150 }],
  };
  return producer
    ? buildHyperframesCompositionHtml(props, {
        producerMode: true,
        runtimeUrl: "/_runtime/gsap.min.js",
      })
    : buildHyperframesCompositionHtml(props);
}

let current = "";
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  try {
    if (pathname === "/page")
      res.setHeader("Content-Type", "text/html").end(current);
    else if (pathname === "/favicon.ico") res.writeHead(204).end();
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
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
});

const failures = [];
const report = { checked: 0, shots: {} };
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) req.abort();
    else req.continue();
  });
  const list = headlines();
  assert.equal(list.length, 30);
  for (const [orientation, width, height] of FORMATS) {
    await page.setViewport({ width, height });
    for (const [templateId, selector] of TEMPLATES) {
      const shots = [];
      for (const [index, text] of list.entries()) {
        current = html(templateId, text, width, height, false);
        await page.goto(`${base}/page`, { waitUntil: "networkidle0" });
        await page.evaluate(() => document.fonts.ready);
        const result = await page.evaluate((sel) => {
          window.__timelines.reel.seek(4.6, true);
          const el = document.querySelector(sel);
          const box = document.querySelector("#root").getBoundingClientRect();
          const lines = [...el.querySelectorAll(".fx-line-inner")];
          const rects = (lines.length ? lines : [el]).map((n) =>
            n.getBoundingClientRect(),
          );
          return {
            text: lines.length
              ? lines.map((n) => n.textContent).join(" ")
              : el.textContent,
            lines: lines.map((n) => n.textContent.trim()),
            inside: rects.every(
              (r) =>
                r.left >= box.left - 1 &&
                r.right <= box.right + 1 &&
                r.top >= box.top - 1 &&
                r.bottom <= box.bottom + 1,
            ),
          };
        }, selector);
        report.checked += 1;
        const label = `${orientation}/${templateId}/#${index}`;
        if (norm(result.text) !== norm(text))
          failures.push(
            `${label}: text differs: "${norm(result.text)}" vs "${text}"`,
          );
        if (/[…]|\.\.\.$/.test(result.text))
          failures.push(`${label}: ellipsis in "${result.text}"`);
        if (!result.inside) failures.push(`${label}: text leaves the frame`);
        const total = norm(text).split(" ").length;
        const last = result.lines.at(-1)?.split(/\s+/).length ?? 0;
        if (total >= 4 && result.lines.length > 1 && last < 2)
          failures.push(
            `${label}: single-word last line "${result.lines.at(-1)}"`,
          );
        if (
          templateId === "hf-statement" &&
          [0, 5, 11, 17, 23, 29].includes(index)
        ) {
          const file = path.join(
            outDir,
            `${orientation}-${String(index).padStart(2, "0")}.png`,
          );
          await page.screenshot({ path: file });
          shots.push(file);
        }
      }
      if (templateId === "hf-statement") report.shots[orientation] = shots;
    }
  }
} finally {
  await browser.close();
  server.close();
}

// Planner: long narration is shortened only to complete sentences or clauses.
const longText = [
  "A strong explainer begins with one clear idea, a promise to the viewer, and a reason to keep watching until the very end of the video today.",
  "Most habits fail because they ask too much too soon. Start smaller than feels useful and let the routine earn its place.",
  "We tested the new layout with forty five creators across three formats, and every single one of them preferred the version with larger type and fewer words on screen.",
].join("\n\n");
for (const preset of ["editorial-explainer", "creator-punch"]) {
  const plan = createDeterministicProductionPlan({
    name: "T",
    text: longText,
    presetId: preset,
    videoEngine: "hyperframes",
    hasVisualAsset: false,
  });
  for (const scene of plan.plan.scenes) {
    if (/[…]/.test(scene.text) || /\.\.\.$/.test(scene.text))
      failures.push(`planner/${preset}: ellipsis in "${scene.text}"`);
    if (
      !/[.!?]$/.test(scene.text) &&
      scene.spokenText &&
      scene.text !== scene.spokenText
    ) {
      // A clause cut is allowed only when it ends at a clause boundary of the source.
      if (!scene.spokenText.startsWith(scene.text)) {
        failures.push(
          `planner/${preset}: "${scene.text}" is not a prefix of its narration`,
        );
      } else if (
        !/[,;:\u2013\u2014]/.test(scene.spokenText.charAt(scene.text.length))
      ) {
        failures.push(`planner/${preset}: "${scene.text}" is cut mid-clause`);
      }
    }
  }
}

// Contact sheets: one per format, six headlines each.
for (const [orientation, files] of Object.entries(report.shots)) {
  const sheet = path.join(outDir, `contact-sheet-${orientation}.jpg`);
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-framerate",
    "1",
    "-pattern_type",
    "glob",
    "-i",
    path.join(outDir, `${orientation}-*.png`),
    "-vf",
    `scale=${orientation === "landscape" ? 480 : 300}:-2,tile=3x2:padding=6:margin=6:color=0x111111`,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    sheet,
  ]);
}
await writeFile(
  path.join(outDir, "report.json"),
  JSON.stringify({ ...report, failures }, null, 2),
);
if (failures.length) {
  console.error(
    `Copy fit FAILED (${failures.length} problems out of ${report.checked} renders):`,
  );
  for (const f of failures.slice(0, 40)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `Copy fit OK: ${report.checked} headline renders (30 headlines x 3 formats x 2 templates), planner clean. Output: ${outDir}`,
);
