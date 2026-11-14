/**
 * Frame lint (roadmap V1): look at one frame per scene, mid-hold, and measure
 * what a viewer sees. Renders the real compiled composition in the render
 * browser (no voice, no network), so it takes seconds, not minutes.
 *
 *   npm run examples:lint-frames [-- --only <name>] [--theme <id>] [--all-formats] [--out <dir>] [--write-baseline] [--gate]
 *
 * Checks per scene (see docs/QUALITY.md): frame fill, smallest text, contrast,
 * text outside the safe area, headline against caption, and near-identical
 * neighbours. Output: JSON plus an annotated contact sheet per example.
 */
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition.ts";
import { lintStoryboard } from "../src/storyboard/lint.ts";
import { storyboardToReelProps } from "../src/production/storyboard-reel.ts";

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(
  pathToFileURL(require.resolve("puppeteer"))
);
const args = process.argv.slice(2);
const value = (flag) =>
  args.indexOf(flag) >= 0 ? args[args.indexOf(flag) + 1] : undefined;
const only = value("--only");
const themeOverride = value("--theme");
const seedOverride = value("--seed");
const varietyOverride = value("--variety");
const allFormats = args.includes("--all-formats");
const gate = args.includes("--gate");
const writeBaseline = args.includes("--write-baseline");
const outDir = path.resolve(value("--out") ?? ".artifacts/frame-lint");
const examplesDir = path.resolve("examples/storyboards");

/** Thresholds. Fill and the 9:16 text minimum come from the roadmap; the others are decisions recorded in docs/QUALITY.md. */
export const THRESHOLDS = {
  fill: 0.45,
  textFill: 0.1,
  minTextShare: { portrait: 0.022, landscape: 0.026, square: 0.024 },
  contrast: { small: 4.5, large: 3 },
  captionSimilarity: 0.8,
  nearIdenticalBits: 3,
  /** Share of adjacent scene pairs allowed to repeat (roadmap V11). */
  monotony: { sameLayout: 0, sameMotion: 0.5, nearIdentical: 0.2 },
};
/** Safe areas as fractions: platform UI keeps the bottom 18% and right 12% of 9:16 clear. */
const SAFE = {
  portrait: { top: 0.078, left: 0.06, right: 0.12, bottom: 0.18 },
  landscape: { top: 0.075, left: 0.075, right: 0.075, bottom: 0.1 },
  square: { top: 0.08, left: 0.08, right: 0.08, bottom: 0.13 },
};
// Real canvas sizes: type and layout are authored in pixels for these.
const FORMATS = [
  ["9:16", "portrait", 1080, 1920],
  ["16:9", "landscape", 1920, 1080],
  ["1:1", "square", 1080, 1080],
];

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

/** Runs in the page. Measures the current frame and returns plain data. */
async function measureInPage(safe, png, sceneId) {
  const W = window.innerWidth,
    H = window.innerHeight;
  const root = document.querySelector("#root") ?? document.body;
  const safeRect = {
    left: safe.left * W,
    top: safe.top * H,
    right: W - safe.right * W,
    bottom: H - safe.bottom * H,
  };
  const visible = (el) => {
    let opacity = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden") return 0;
      opacity *= parseFloat(s.opacity);
    }
    return opacity;
  };
  const inCaption = (el) => !!el.closest(".rs-subtitle");
  const DECOR =
    /(glow|atmos|backplate|beam|shine|stage|floor|bg|blob|orb|aura|noise|vignette|shade|grain|letterbox)/;
  const decorative = (el) => {
    if (
      el.closest(
        ".progress, .fx-grain, .fx-letterbox, [aria-hidden='true'], .bg-mood, .cover",
      )
    )
      return true;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (
        n.className &&
        typeof n.className === "string" &&
        DECOR.test(n.className) &&
        !/stage/.test(n.className)
      )
        return true;
      if (/blur/.test(getComputedStyle(n).filter)) return true;
    }
    return false;
  };
  const rgba = (c) => {
    const m = c.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [0, 0, 0, 1];
    // Modern colour functions (color-mix) compute to color(srgb r g b / a) in 0..1.
    if (/^color\(/.test(c))
      return { r: m[0] * 255, g: m[1] * 255, b: m[2] * 255, a: m[3] ?? 1 };
    return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
  };

  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.replace(/\s+/g, " ").trim();
    const el = node.parentElement;
    if (
      text.length < 2 ||
      !el ||
      ["SCRIPT", "STYLE"].includes(el.tagName) ||
      decorative(el)
    )
      continue;
    const opacity = visible(el);
    if (opacity < 0.3) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el);
    const gradientText =
      s.webkitTextFillColor === "rgba(0, 0, 0, 0)" ||
      s.backgroundClip === "text";
    texts.push({
      text,
      caption: inCaption(el),
      size: parseFloat(s.fontSize),
      opacity,
      color: rgba(s.color),
      gradientText,
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
    });
  }

  // Content rectangles: text, media, graphics and visible blocks (not full-bleed backgrounds).
  const rects = texts.filter((t) => !t.caption).map((t) => t.rect);
  root
    .querySelectorAll(
      "img,video,svg,canvas,[data-chart],.fx-card,.fx-bar,.am-bar,.fx-plate",
    )
    .forEach((el) => {
      if (decorative(el) || inCaption(el) || visible(el) < 0.3) return;
      const r = el.getBoundingClientRect();
      if (
        r.width * r.height < W * H * 0.004 ||
        r.width * r.height > W * H * 0.7
      )
        return;
      rects.push({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      });
    });
  root.querySelectorAll("div,span,li,section").forEach((el) => {
    if (decorative(el) || inCaption(el) || el.children.length > 6) return;
    const s = getComputedStyle(el);
    const solid =
      rgba(s.backgroundColor).a > 0.2 ||
      (parseFloat(s.borderTopWidth) > 0 && rgba(s.borderTopColor).a > 0.3);
    if (!solid || visible(el) < 0.3) return;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < W * H * 0.004 || area > W * H * 0.7) return;
    rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  });
  const bbox = rects.length
    ? {
        left: Math.min(...rects.map((r) => r.left)),
        top: Math.min(...rects.map((r) => r.top)),
        right: Math.max(...rects.map((r) => r.right)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
      }
    : null;
  const safeArea =
    (safeRect.right - safeRect.left) * (safeRect.bottom - safeRect.top);
  const clip = (b) => ({
    left: Math.max(b.left, safeRect.left),
    top: Math.max(b.top, safeRect.top),
    right: Math.min(b.right, safeRect.right),
    bottom: Math.min(b.bottom, safeRect.bottom),
  });
  const bodyText = texts.filter((t) => !t.caption).map((t) => t.rect);
  const textBox = bodyText.length
    ? clip({
        left: Math.min(...bodyText.map((r) => r.left)),
        top: Math.min(...bodyText.map((r) => r.top)),
        right: Math.max(...bodyText.map((r) => r.right)),
        bottom: Math.max(...bodyText.map((r) => r.bottom)),
      })
    : null;
  const textFill = textBox
    ? (Math.max(0, textBox.right - textBox.left) *
        Math.max(0, textBox.bottom - textBox.top)) /
      safeArea
    : 0;
  const fillBox = bbox ? clip(bbox) : null;
  const fill = fillBox
    ? (Math.max(0, fillBox.right - fillBox.left) *
        Math.max(0, fillBox.bottom - fillBox.top)) /
      safeArea
    : 0;

  // Sample the background behind each text rectangle from the screenshot.
  const img = new Image();
  img.src = "data:image/png;base64," + png;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const scale = img.width / W;
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  function ringColor(r) {
    const pad = 4,
      pts = [];
    const xs = [r.left - pad, (r.left + r.right) / 2, r.right + pad],
      ys = [r.top - pad, (r.top + r.bottom) / 2, r.bottom + pad];
    for (const x of xs)
      for (const y of ys)
        if (!(x > r.left && x < r.right && y > r.top && y < r.bottom))
          pts.push([x, y]);
    const cols = pts
      .filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H)
      .map(([x, y]) => {
        const d = ctx.getImageData(
          Math.round(x * scale),
          Math.round(y * scale),
          1,
          1,
        ).data;
        return { r: d[0], g: d[1], b: d[2] };
      });
    if (!cols.length) return null;
    const mid = (k) =>
      cols.map((c) => c[k]).sort((a, b) => a - b)[Math.floor(cols.length / 2)];
    return { r: mid("r"), g: mid("g"), b: mid("b") };
  }
  for (const t of texts) {
    if (t.gradientText) {
      t.contrast = null;
      continue;
    }
    const bg = ringColor(t.rect);
    if (!bg) {
      t.contrast = null;
      continue;
    }
    const a = t.color.a * t.opacity;
    const fg = {
      r: t.color.r * a + bg.r * (1 - a),
      g: t.color.g * a + bg.g * (1 - a),
      b: t.color.b * a + bg.b * (1 - a),
    };
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    t.contrast = (hi + 0.05) / (lo + 0.05);
  }

  // Average hash of the frame (8x8 grey).
  const tiny = document.createElement("canvas");
  tiny.width = 8;
  tiny.height = 8;
  const tctx = tiny.getContext("2d");
  tctx.drawImage(img, 0, 0, 8, 8);
  const px = tctx.getImageData(0, 0, 8, 8).data;
  const grey = [];
  for (let i = 0; i < 64; i++)
    grey.push(
      0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2],
    );
  const mean = grey.reduce((a, b) => a + b, 0) / 64;
  const hash = grey.map((g) => (g > mean ? 1 : 0)).join("");

  const recipe =
    root
      .querySelector(`[data-scene-id="${sceneId}"] [data-recipe]`)
      ?.getAttribute("data-recipe") ?? null;
  const sceneEl = root.querySelector(`[data-scene-id="${sceneId}"]`);
  const layout = sceneEl?.getAttribute("data-layout") ?? null;
  const motion = sceneEl?.getAttribute("data-motion") ?? null;
  return {
    W,
    H,
    safeRect,
    bbox,
    fill,
    textFill,
    texts,
    hash,
    recipe,
    layout,
    motion,
  };
}

async function lintStoryboardFile(file, formatOverride) {
  const raw = JSON.parse(await readFile(path.join(examplesDir, file), "utf8"));
  if (raw.kind === "podcast") return null;
  if (formatOverride) raw.format = formatOverride;
  if (themeOverride) raw.theme = themeOverride;
  if (seedOverride) raw.seed = seedOverride;
  if (varietyOverride) raw.variety = varietyOverride;
  const storyboard = lintStoryboard(raw).storyboard;
  const reel = storyboardToReelProps(storyboard);
  const [, orientation, width, height] = FORMATS.find(
    ([f]) => f === storyboard.format,
  );
  const props = { ...reel.props, width, height };
  current = buildHyperframesCompositionHtml(props);
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) =>
    /^https?:/.test(req.url()) && !req.url().startsWith(base)
      ? req.abort()
      : req.continue(),
  );
  await page.setViewport({ width, height });
  await page.goto(`${base}/page`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const safe = SAFE[orientation];
  const results = [];
  const shots = [];
  for (const [index, span] of reel.spans.entries()) {
    const time =
      (span.startFrame + (span.endFrame - span.startFrame) * 0.6) / props.fps;
    await page.evaluate((t) => window.__timelines.reel.seek(t, true), time);
    const png = await page.screenshot({ encoding: "base64" });
    const scene = props.scenes[index];
    const m = await page.evaluate(measureInPage, safe, png, scene.id);
    const failures = [];
    const body = m.texts.filter((t) => !t.caption);
    if (m.textFill < THRESHOLDS.textFill)
      failures.push({
        check: "text-fill",
        measured: +m.textFill.toFixed(3),
        threshold: THRESHOLDS.textFill,
      });
    if (m.fill < THRESHOLDS.fill)
      failures.push({
        check: "frame-fill",
        measured: +m.fill.toFixed(3),
        threshold: THRESHOLDS.fill,
      });
    const minShare = THRESHOLDS.minTextShare[orientation];
    const smallest = body.length
      ? body.reduce((a, b) => (b.size < a.size ? b : a))
      : null;
    if (smallest && smallest.size / m.H < minShare)
      failures.push({
        check: "smallest-text",
        measured: +(smallest.size / m.H).toFixed(4),
        threshold: minShare,
        text: smallest.text.slice(0, 40),
      });
    for (const t of m.texts) {
      if (t.contrast === null) continue;
      const large = t.size / m.H >= 0.04;
      const need = large
        ? THRESHOLDS.contrast.large
        : THRESHOLDS.contrast.small;
      if (t.contrast < need)
        failures.push({
          check: "contrast",
          measured: +t.contrast.toFixed(2),
          threshold: need,
          text: t.text.slice(0, 40),
        });
    }
    for (const t of body) {
      const r = t.rect,
        s = m.safeRect,
        tol = 2;
      if (
        r.left < s.left - tol ||
        r.right > s.right + tol ||
        r.top < s.top - tol ||
        r.bottom > s.bottom + tol
      )
        failures.push({
          check: "outside-safe-area",
          measured: "text rectangle leaves the safe area",
          threshold: "inside",
          text: t.text.slice(0, 40),
        });
    }
    const caption = m.texts
      .filter((t) => t.caption)
      .map((t) => t.text)
      .join(" ");
    const tokens = (s) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^\p{L}\p{N} ]/gu, "")
          .split(/\s+/)
          .filter(Boolean),
      );
    const a = tokens(scene.text),
      b = tokens(caption);
    const inter = [...a].filter((x) => b.has(x)).length;
    const sim = a.size && b.size ? inter / Math.min(a.size, b.size) : 0;
    if (caption && sim >= THRESHOLDS.captionSimilarity && a.size >= 3)
      failures.push({
        check: "headline-equals-caption",
        measured: +sim.toFixed(2),
        threshold: THRESHOLDS.captionSimilarity,
        text: caption.slice(0, 40),
      });
    results.push({
      scene: index + 1,
      type: scene.templateId,
      recipe: m.recipe,
      layout: m.layout,
      motion: m.motion,
      fill: +m.fill.toFixed(3),
      failures,
      hash: m.hash,
      png,
      annotate: {
        safe: m.safeRect,
        bbox: m.bbox,
        bad: failures.filter((f) => f.check !== "frame-fill").length,
      },
    });
    shots.push(png);
  }
  for (let i = 1; i < results.length; i++) {
    const bits = [...results[i].hash].filter(
      (c, k) => c !== results[i - 1].hash[k],
    ).length;
    if (bits <= THRESHOLDS.nearIdenticalBits)
      results[i].failures.push({
        check: "near-identical-neighbour",
        measured: bits,
        threshold: `> ${THRESHOLDS.nearIdenticalBits} bits differ`,
        with: `scene ${i}`,
      });
  }
  // Annotated contact sheet.
  const name =
    file.replace(/\.json$/, "") + (formatOverride ? `-${orientation}` : "");
  await mkdir(outDir, { recursive: true });
  const files = [];
  for (const [index, r] of results.entries()) {
    await page.evaluate((png) => {
      document.body.dataset.png = png;
    }, r.png);
    await page.evaluate(({ safe, bbox, bad }) => {
      document.querySelectorAll(".fl-overlay").forEach((n) => n.remove());
      const box = (r, color, dash) => {
        const d = document.createElement("div");
        d.className = "fl-overlay";
        Object.assign(d.style, {
          position: "fixed",
          left: r.left + "px",
          top: r.top + "px",
          width: r.right - r.left + "px",
          height: r.bottom - r.top + "px",
          border: `2px ${dash ? "dashed" : "solid"} ${color}`,
          zIndex: 99999,
          pointerEvents: "none",
        });
        document.body.append(d);
      };
      box(safe, "#22c55e", true);
      if (bbox) box(bbox, bad ? "#ef4444" : "#06b6d4", false);
    }, r.annotate);
    await page.evaluate(
      (t) => window.__timelines.reel.seek(t, true),
      (reel.spans[index].startFrame +
        (reel.spans[index].endFrame - reel.spans[index].startFrame) * 0.6) /
        props.fps,
    );
    const file2 = path.join(
      outDir,
      `${name}-${String(index + 1).padStart(2, "0")}.png`,
    );
    await page.screenshot({ path: file2 });
    files.push(file2);
  }
  await page.close();
  const columns = orientation === "landscape" ? 3 : 4;
  const rows = Math.ceil(files.length / columns);
  const tileW = orientation === "landscape" ? 420 : 240;
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-framerate",
    "1",
    "-i",
    path.join(outDir, `${name}-%02d.png`),
    "-vf",
    `scale=${tileW}:-2,tile=${columns}x${rows}:padding=4:margin=4:color=0x111111`,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    path.join(outDir, `${name}.contact-sheet.jpg`),
  ]);
  // Monotony (roadmap V11): how many neighbouring scenes repeat the layout or
  // the motion, or look near-identical. Gated at the thresholds below.
  const pairs = Math.max(1, results.length - 1);
  let sameLayout = 0;
  let sameMotion = 0;
  let nearIdentical = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i].layout && results[i].layout === results[i - 1].layout)
      sameLayout += 1;
    if (results[i].motion && results[i].motion === results[i - 1].motion)
      sameMotion += 1;
    const bits = [...results[i].hash].filter(
      (c, k) => c !== results[i - 1].hash[k],
    ).length;
    if (bits <= THRESHOLDS.nearIdenticalBits) nearIdentical += 1;
  }
  const monotony = {
    sameLayout: +(sameLayout / pairs).toFixed(2),
    sameMotion: +(sameMotion / pairs).toFixed(2),
    nearIdentical: +(nearIdentical / pairs).toFixed(2),
  };
  const monotonyFails = [];
  if (monotony.sameLayout > THRESHOLDS.monotony.sameLayout)
    monotonyFails.push("same-layout");
  if (monotony.sameMotion > THRESHOLDS.monotony.sameMotion)
    monotonyFails.push("same-motion");
  if (monotony.nearIdentical > THRESHOLDS.monotony.nearIdentical)
    monotonyFails.push("near-identical");
  if (monotonyFails.length)
    results[0].failures.push({
      check: "monotony",
      measured: monotony,
      threshold: THRESHOLDS.monotony,
      text: monotonyFails.join(", "),
    });
  return {
    name,
    format: storyboard.format,
    preset: reel.presetId,
    monotony,
    scenes: results.map(({ png, hash, annotate, ...rest }) => rest),
  };
}

const report = { thresholds: THRESHOLDS, examples: [] };
try {
  const files = (await readdir(examplesDir))
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const file of files) {
    if (only && file.replace(/\.json$/, "") !== only) continue;
    for (const override of allFormats ? FORMATS.map(([f]) => f) : [undefined]) {
      const result = await lintStoryboardFile(file, override);
      if (!result) continue;
      const fails = result.scenes.flatMap((s) => s.failures);
      const byCheck = {};
      for (const f of fails) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
      result.summary = {
        scenes: result.scenes.length,
        failures: fails.length,
        byCheck,
        meanFill: +(
          result.scenes.reduce((a, s) => a + s.fill, 0) / result.scenes.length
        ).toFixed(3),
      };
      report.examples.push(result);
      console.log(
        `${fails.length ? "✗" : "✓"} ${result.name.padEnd(24)} ${result.format.padEnd(5)} ${result.preset.padEnd(20)} fill ${result.summary.meanFill}  ${fails.length} failure(s) ${JSON.stringify(byCheck)}`,
      );
    }
  }
} finally {
  await browser.close();
  server.close();
}
await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "frame-lint.json"),
  JSON.stringify(report, null, 2),
);
const total = report.examples.reduce((n, e) => n + e.summary.failures, 0);
if (writeBaseline) {
  const baseline = {
    recordedAt: new Date().toISOString().slice(0, 10),
    thresholds: THRESHOLDS,
    examples: report.examples.map((e) => ({
      name: e.name,
      format: e.format,
      preset: e.preset,
      ...e.summary,
    })),
  };
  await mkdir("docs/quality", { recursive: true });
  await writeFile(
    "docs/quality/baseline.json",
    JSON.stringify(baseline, null, 2) + "\n",
  );
  console.log("Wrote docs/quality/baseline.json");
}
console.log(
  `\n${report.examples.length} example(s), ${total} failure(s). Report: ${path.join(outDir, "frame-lint.json")}`,
);
if (gate && total > 0) process.exit(1);
