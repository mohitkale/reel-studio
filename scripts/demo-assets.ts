/**
 * `npm run demo:assets`: regenerate every image and video the README uses
 * (roadmap L2) into `dist/demo/`, with a manifest and an `index.html`.
 *
 *   npm run demo:assets [-- --skip-ui] [-- --skip-sheets] [-- --skip-media]
 *                       [-- --only media,sheets,ui] [-- --rerender]
 *                       [-- --upload <release-tag>]
 *
 * Inputs:
 *   - the golden storyboards rendered by `npm run showcase` (media/showcase/*.mp4;
 *     the app and its worker must be running). Missing ones are rendered first;
 *     `--rerender` renders them all again.
 *   - the theme and scene-type contact sheets (`scripts/theme-sheet.mjs`,
 *     `scripts/scene-sheet.mjs`), unless `--skip-sheets`.
 *   - scripted browser sessions and an MCP session (`scripts/demo-capture-ui.ts`),
 *     unless `--skip-ui`.
 *
 * Every GIF has an MP4 twin and is held under its size cap (hero 8 MB, gallery
 * 3 MB); the run fails if a file cannot be brought under its cap.
 * `--upload <tag>` attaches the files to that GitHub release (a public action,
 * so it only runs when asked for).
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { readNicheIndex } from "../src/storyboard/niches-check";

const argv = process.argv.slice(2);
const has = (name: string) => argv.includes(name);
const value = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const SHOWCASE = path.resolve("media/showcase");
const OUT = path.resolve("dist/demo");
const WORK = path.join(OUT, ".work");
const MB = 1024 * 1024;
export const HERO_CAP = 8 * MB;
export const GALLERY_CAP = 3 * MB;

/** Three portrait videos side by side. */
const HERO = ["listicle", "product-launch", "motivation"] as const;
/** Six videos, one of each shape and subject, for the gallery. */
const GALLERY = [
  { name: "listicle", title: "A list that holds attention" },
  { name: "product-launch", title: "A product launch" },
  { name: "how-to", title: "A how-to" },
  { name: "explainer", title: "An explainer" },
  { name: "data-story", title: "Numbers as a story" },
  { name: "developer-demo", title: "A developer demo" },
] as const;

/** The other golden videos the website gallery shows (the README shows the six above). */
const SITE_EXTRA = [
  "comparison",
  "motivation",
  "myth-vs-fact",
  "news-recap",
  "story",
] as const;

interface Entry {
  file: string;
  kind: string;
  bytes: number;
  cap?: number;
  source: string;
  note?: string;
}
const manifest: Entry[] = [];

function ffmpeg(...args: string[]): void {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
}
const size = (file: string) => statSync(file).size;
const fmtMb = (bytes: number) => `${(bytes / MB).toFixed(2)} MB`;

function record(
  file: string,
  kind: string,
  source: string,
  cap?: number,
  note?: string,
): Entry {
  const entry: Entry = {
    file: path.relative(OUT, file).split(path.sep).join("/"),
    kind,
    bytes: size(file),
    source,
    ...(cap ? { cap } : {}),
    ...(note ? { note } : {}),
  };
  manifest.push(entry);
  return entry;
}

/** Palette-optimised GIF from a filtergraph input, shrunk step by step until it fits its cap. */
function gif(args: {
  inputs: string[];
  /** Filtergraph that ends in the label [v] (before the GIF palette). */
  graph: (maxSide: number) => string;
  output: string;
  cap: number;
}): { fps: number; maxSide: number } {
  const attempts = [
    { fps: 15, maxSide: 540, colors: 192 },
    { fps: 12, maxSide: 480, colors: 160 },
    { fps: 12, maxSide: 420, colors: 128 },
    { fps: 10, maxSide: 380, colors: 128 },
    { fps: 10, maxSide: 340, colors: 96 },
    { fps: 8, maxSide: 300, colors: 64 },
  ];
  for (const attempt of attempts) {
    ffmpeg(
      ...args.inputs,
      "-filter_complex",
      `${args.graph(attempt.maxSide)};[v]fps=${attempt.fps},split[a][b];` +
        `[a]palettegen=max_colors=${attempt.colors}:stats_mode=diff[p];` +
        `[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[g]`,
      "-map",
      "[g]",
      "-loop",
      "0",
      args.output,
    );
    if (size(args.output) <= args.cap) return attempt;
  }
  throw new Error(
    `${path.basename(args.output)} is ${fmtMb(size(args.output))}, over its ${fmtMb(args.cap)} cap even at the smallest setting`,
  );
}

/** The same clip as an MP4 twin of the GIF's source: H.264, faststart, audio kept. */
function twin(input: string, output: string, maxSide = 1280): void {
  ffmpeg(
    "-i",
    input,
    "-vf",
    `scale='if(gt(iw,ih),min(iw,${maxSide}),-2)':'if(gt(iw,ih),-2,min(ih,${maxSide}))'`,
    "-c:v",
    "libx264",
    "-crf",
    "27",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    output,
  );
}

function duration(file: string): number {
  return Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nw=1:nk=1",
        file,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
}

async function ensureShowcase(): Promise<void> {
  const needed = [
    ...new Set([...HERO, ...GALLERY.map((g) => g.name), ...SITE_EXTRA]),
  ];
  const missing = has("--rerender")
    ? needed
    : needed.filter((name) => !existsSync(path.join(SHOWCASE, `${name}.mp4`)));
  if (missing.length === 0) return;
  console.log(
    `Rendering ${missing.length} golden storyboards: ${missing.join(", ")}`,
  );
  try {
    execFileSync(
      "npm",
      ["run", "showcase", "--", "--only", missing.join(",")],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
  } catch {
    throw new Error(
      "Could not render the golden storyboards. Start the app and its worker (`npm run dev`), then run this again.",
    );
  }
  for (const name of missing)
    if (!existsSync(path.join(SHOWCASE, `${name}.mp4`)))
      throw new Error(`${name}.mp4 is missing after the showcase run`);
}

function heroMontage(): void {
  const inputs = HERO.map((name) => path.join(SHOWCASE, `${name}.mp4`));
  const seconds = 9;
  // Each video starts a little in, where the first scene has settled.
  const starts = [3, 4, 2];
  const parts = inputs
    .map(
      (_, i) =>
        `[${i}:v]trim=start=${starts[i]}:duration=${seconds},setpts=PTS-STARTPTS,` +
        `scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:color=black[h${i}]`,
    )
    .join(";");
  const stacked = `${parts};${HERO.map((_, i) => `[h${i}]`).join("")}hstack=inputs=${HERO.length}[m]`;
  const inArgs = inputs.flatMap((f) => ["-i", f]);
  const source = HERO.join(" + ");

  const mp4 = path.join(OUT, "hero.mp4");
  ffmpeg(
    ...inArgs,
    "-filter_complex",
    stacked,
    "-map",
    "[m]",
    "-an",
    "-c:v",
    "libx264",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4,
  );
  record(mp4, "hero-mp4", source, HERO_CAP);

  const webm = path.join(OUT, "hero.webm");
  ffmpeg(
    ...inArgs,
    "-filter_complex",
    stacked,
    "-map",
    "[m]",
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "38",
    "-b:v",
    "0",
    webm,
  );
  record(webm, "hero-webm", source, HERO_CAP);

  const heroGif = path.join(OUT, "hero.gif");
  const used = gif({
    inputs: inArgs,
    graph: (maxSide) =>
      `${stacked.replace("[m]", "[m0]")};[m0]scale='min(iw,${maxSide * 2})':-2:flags=lanczos[v]`,
    output: heroGif,
    cap: HERO_CAP,
  });
  record(heroGif, "hero-gif", source, HERO_CAP, `${used.fps} fps`);
}

function galleryGifs(): void {
  for (const { name, title } of GALLERY) {
    const input = path.join(SHOWCASE, `${name}.mp4`);
    const total = duration(input);
    const clip = 6;
    const start = Math.max(1, Math.min(total * 0.25, total - clip - 1));
    const output = path.join(OUT, `gallery-${name}.gif`);
    const used = gif({
      inputs: ["-ss", start.toFixed(2), "-t", String(clip), "-i", input],
      graph: (maxSide) =>
        `[0:v]scale='if(gt(iw,ih),${maxSide},-2)':'if(gt(iw,ih),-2,${maxSide})':flags=lanczos[v]`,
      output,
      cap: GALLERY_CAP,
    });
    record(
      output,
      "gallery-gif",
      `examples/storyboards/${name}.json`,
      GALLERY_CAP,
      title,
    );
    const mp4 = path.join(OUT, `gallery-${name}.mp4`);
    twin(input, mp4);
    record(
      mp4,
      "gallery-mp4",
      `examples/storyboards/${name}.json`,
      undefined,
      `full video, twin of gallery-${name}.gif (${used.fps} fps GIF)`,
    );
  }
}

/** Posters for every gallery video, the other videos' MP4s, and the hero poster (website, roadmap L3). */
function siteMedia(): void {
  const poster = (input: string, output: string, at: number, maxSide: number) =>
    ffmpeg(
      "-ss",
      at.toFixed(2),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      `scale='if(gt(iw,ih),${maxSide},-2)':'if(gt(iw,ih),-2,${maxSide})':flags=lanczos`,
      "-q:v",
      "5",
      output,
    );
  const names = [...GALLERY.map((g) => g.name), ...SITE_EXTRA] as string[];
  for (const name of names) {
    const input = path.join(SHOWCASE, `${name}.mp4`);
    const output = path.join(OUT, `gallery-${name}.jpg`);
    poster(input, output, Math.min(3, duration(input) / 4), 640);
    record(output, "gallery-poster", `examples/storyboards/${name}.json`);
  }
  for (const name of SITE_EXTRA) {
    const mp4 = path.join(OUT, `gallery-${name}.mp4`);
    twin(path.join(SHOWCASE, `${name}.mp4`), mp4);
    record(
      mp4,
      "gallery-mp4",
      `examples/storyboards/${name}.json`,
      undefined,
      "full video, for the website gallery",
    );
  }
  const hero = path.join(OUT, "hero-poster.jpg");
  poster(path.join(OUT, "hero.mp4"), hero, 2, 1080);
  record(
    hero,
    "gallery-poster",
    HERO.join(" + "),
    undefined,
    "hero video poster",
  );
}

/**
 * The thirty niche videos for the website's showcase wall (roadmap L8): an MP4
 * and a poster each, and a 45-second montage of nine of them for the README and
 * social posts. Needs `npm run showcase -- --set niches` first.
 */
const NICHES_RENDERS = path.resolve("media/showcase-niches");
/** Nine portrait videos from nine niches, three at a time, fifteen seconds each. */
const MONTAGE = [
  "tech-what-is-a-cookie",
  "finance-the-rule-of-72",
  "history-the-stone-that-unlocked-egypt",
  "science-how-a-vaccine-teaches-your-body",
  "language-one-syllable-four-meanings",
  "fitness-sleep-is-part-of-training",
  "launch-meet-lumen",
  "productivity-do-it-in-two-minutes",
  "books-frankenstein-in-a-minute",
] as const;

function nichesRendered(): boolean {
  return readNicheIndex().entries.every((e) =>
    existsSync(path.join(NICHES_RENDERS, e.file.replace(/\.json$/, ".mp4"))),
  );
}

function nicheMedia(): void {
  for (const entry of readNicheIndex().entries) {
    const name = entry.file.replace(/\.json$/, "");
    const input = path.join(NICHES_RENDERS, `${name}.mp4`);
    if (!existsSync(input))
      throw new Error(
        `${name}.mp4 is missing. Render the niches first: npm run showcase -- --set niches`,
      );
    const source = `examples/niches/${entry.file}`;
    const poster = path.join(OUT, `niche-${name}.jpg`);
    ffmpeg(
      "-ss",
      Math.min(3, duration(input) / 4).toFixed(2),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      "scale='if(gt(iw,ih),640,-2)':'if(gt(iw,ih),-2,640)':flags=lanczos",
      "-q:v",
      "5",
      poster,
    );
    record(poster, "niche-poster", source);
    const mp4 = path.join(OUT, `niche-${name}.mp4`);
    twin(input, mp4, 960);
    record(mp4, "niche-mp4", source, undefined, entry.title);
  }
  // The montage: three portrait videos side by side, three times, 45 s in all.
  const parts = [0, 1, 2].map((row) =>
    MONTAGE.slice(row * 3, row * 3 + 3).map((name) =>
      path.join(NICHES_RENDERS, `${name}.mp4`),
    ),
  );
  const inputs = parts.flat().flatMap((f) => ["-ss", "3", "-t", "15", "-i", f]);
  const stack = (row: number) =>
    [0, 1, 2]
      .map(
        (i) =>
          `[${row * 3 + i}:v]setpts=PTS-STARTPTS,scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:color=black[m${row * 3 + i}]`,
      )
      .join(";") +
    `;[m${row * 3}][m${row * 3 + 1}][m${row * 3 + 2}]hstack=inputs=3[r${row}]`;
  const graph = `${stack(0)};${stack(1)};${stack(2)};[r0][r1][r2]concat=n=3:v=1:a=0[v]`;
  const source = MONTAGE.map((n) => `examples/niches/${n}.json`).join(" + ");
  const montageMp4 = path.join(OUT, "montage.mp4");
  ffmpeg(
    ...inputs,
    "-filter_complex",
    graph,
    "-map",
    "[v]",
    "-an",
    "-c:v",
    "libx264",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    montageMp4,
  );
  record(montageMp4, "montage-mp4", source, HERO_CAP, "45 s, nine niches");
  const montageWebm = path.join(OUT, "montage.webm");
  ffmpeg(
    ...inputs,
    "-filter_complex",
    graph,
    "-map",
    "[v]",
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "38",
    "-b:v",
    "0",
    montageWebm,
  );
  record(montageWebm, "montage-webm", source, HERO_CAP, "45 s, nine niches");
}

/** One finished frame, shown next to the storyboard lines that made it. */
function frame(): void {
  const input = path.join(SHOWCASE, "listicle.mp4");
  const output = path.join(OUT, "frame-listicle.jpg");
  ffmpeg(
    "-ss",
    "2.5",
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale=-2:640:flags=lanczos",
    "-q:v",
    "4",
    output,
  );
  record(
    output,
    "frame",
    "examples/storyboards/listicle.json",
    undefined,
    "first scene, 2.5 s in",
  );
}

function sheets(): void {
  const themes = path.join(WORK, "themes");
  const scenes = path.join(WORK, "scenes");
  execFileSync("node", ["scripts/theme-sheet.mjs", "--out", themes], {
    stdio: "inherit",
  });
  const themeSheet = path.join(OUT, "sheet-themes.jpg");
  copyFileSync(path.join(themes, "product-launch-themes.jpg"), themeSheet);
  record(themeSheet, "theme-sheet", "examples/storyboards/product-launch.json");
  execFileSync(
    "node",
    ["--import", "tsx", "scripts/scene-sheet.mjs", "--out", scenes],
    {
      stdio: "inherit",
    },
  );
  for (const format of ["portrait", "landscape", "square"]) {
    const target = path.join(OUT, `sheet-scene-types-${format}.jpg`);
    copyFileSync(
      path.join(scenes, `zz-scene-tour-${format}.contact-sheet.jpg`),
      target,
    );
    record(target, "scene-sheet", "every registered scene type's own sample");
  }
}

function ui(): void {
  const dir = path.join(WORK, "ui");
  rmSync(dir, { recursive: true, force: true });
  execFileSync("npx", ["tsx", "scripts/demo-capture-ui.ts", "--out", dir], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  for (const name of [
    "ui-home",
    "ui-generation",
    "ui-result",
    "ui-home-mobile",
    "ui-result-mobile",
  ]) {
    const target = path.join(OUT, `${name}.png`);
    copyFileSync(path.join(dir, `${name}.png`), target);
    record(
      target,
      "screenshot",
      "scripted browser session (demo-capture-ui.ts)",
    );
  }

  // The prompt-to-video recording: the long wait while the video is made is sped up.
  const marks = JSON.parse(
    readFileSync(path.join(dir, "ui-recording.json"), "utf8"),
  ) as Record<string, number>;
  const webm = path.join(dir, "ui-recording.webm");
  const waitFrom = marks.generationShown + 1;
  const waitTo = Math.max(waitFrom + 1, marks.resultShown - 2);
  const speed = 12;
  const cut = (a: number, b: number, label: string, factor = 1) =>
    `[0:v]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${factor}[${label}]`;
  const graph =
    `${cut(marks.homeShown - 0.5 > 0 ? marks.homeShown - 0.5 : 0, waitFrom, "a")};` +
    `${cut(waitFrom, waitTo, "b", speed)};` +
    `${cut(waitTo, marks.end, "c")};` +
    `[a][b][c]concat=n=3:v=1:a=0[r]`;
  const mp4 = path.join(OUT, "ui-prompt-to-video.mp4");
  ffmpeg(
    "-i",
    webm,
    "-filter_complex",
    graph,
    "-map",
    "[r]",
    "-c:v",
    "libx264",
    "-crf",
    "27",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4,
  );
  record(
    mp4,
    "ui-recording-mp4",
    "scripted browser session (demo-capture-ui.ts)",
    undefined,
    `the wait while rendering is shown ${speed}x faster`,
  );
  const uiGif = path.join(OUT, "ui-prompt-to-video.gif");
  const used = gif({
    inputs: ["-i", mp4],
    graph: (maxSide) =>
      `[0:v]scale='min(iw,${maxSide * 2})':-2:flags=lanczos[v]`,
    output: uiGif,
    cap: HERO_CAP,
  });
  record(
    uiGif,
    "ui-recording-gif",
    "scripted browser session (demo-capture-ui.ts)",
    HERO_CAP,
    `${used.fps} fps`,
  );

  // The MCP flow as a terminal recording.
  const frames = path.join(dir, "terminal", "frames.txt");
  const termMp4 = path.join(OUT, "mcp-terminal.mp4");
  ffmpeg(
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    frames,
    "-vf",
    "fps=10,format=yuv420p",
    "-c:v",
    "libx264",
    "-crf",
    "24",
    "-movflags",
    "+faststart",
    termMp4,
  );
  record(
    termMp4,
    "terminal-mp4",
    "the real MCP server over stdio (demo-capture-ui.ts)",
  );
  const termGif = path.join(OUT, "mcp-terminal.gif");
  gif({
    inputs: ["-f", "concat", "-safe", "0", "-i", frames],
    graph: (maxSide) =>
      `[0:v]scale='min(iw,${Math.max(maxSide * 2, 800)})':-2:flags=lanczos[v]`,
    output: termGif,
    cap: GALLERY_CAP,
  });
  record(
    termGif,
    "terminal-gif",
    "the real MCP server over stdio (demo-capture-ui.ts)",
    GALLERY_CAP,
  );
  // The example podcast episode, as an MP3 for the website gallery.
  const podcast = path.join(OUT, "gallery-podcast.mp3");
  ffmpeg(
    "-i",
    path.join(dir, "episode.wav"),
    "-vn",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "96k",
    "-ac",
    "1",
    podcast,
  );
  record(
    podcast,
    "podcast-audio",
    "examples/storyboards/podcast.json",
    undefined,
    "made by the studio from the example podcast storyboard",
  );
  copyFileSync(
    path.join(dir, "mcp-transcript.json"),
    path.join(OUT, "mcp-transcript.json"),
  );
}

function writeIndex(): void {
  const rows = manifest
    .map(
      (m) =>
        `<tr><td><a href="${m.file}">${m.file}</a></td><td>${m.kind}</td><td>${fmtMb(m.bytes)}${m.cap ? ` / ${fmtMb(m.cap)}` : ""}</td><td>${m.source}</td><td>${m.note ?? ""}</td></tr>`,
    )
    .join("\n");
  const media = manifest
    .filter((m) => /\.(gif|png|jpg)$/.test(m.file))
    .map(
      (m) =>
        `<figure><img src="${m.file}" alt="${m.file}" loading="lazy" style="max-width:100%;max-height:360px"><figcaption>${m.file}</figcaption></figure>`,
    )
    .join("\n");
  writeFileSync(
    path.join(OUT, "index.html"),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel Studio demo assets</title>
<style>body{font:15px system-ui;margin:2rem auto;max-width:1100px;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:.3rem .5rem;text-align:left;vertical-align:top}figure{display:inline-block;margin:.5rem;vertical-align:top}</style>
<h1>Reel Studio demo assets</h1>
<p>Generated by <code>npm run demo:assets</code>. See <code>manifest.json</code>.</p>
<table><tr><th>File</th><th>Kind</th><th>Size / cap</th><th>Source</th><th>Note</th></tr>
${rows}
</table>
<h2>Preview</h2>
${media}
`,
  );
}

async function main(): Promise<void> {
  // `--only media,sheets,ui` redoes some stages and keeps the rest of dist/demo.
  const only = value("--only")?.split(",");
  const stage = (name: string) =>
    only ? only.includes(name) : !has(`--skip-${name}`);
  const previous = path.join(OUT, "manifest.json");
  if (only && existsSync(previous)) {
    const kept = (
      JSON.parse(readFileSync(previous, "utf8")) as { files: Entry[] }
    ).files;
    manifest.push(...kept);
  } else if (!only) {
    rmSync(OUT, { recursive: true, force: true });
  }
  mkdirSync(WORK, { recursive: true });
  const redo = (kinds: RegExp) => {
    for (let i = manifest.length - 1; i >= 0; i--)
      if (kinds.test(manifest[i]!.kind)) manifest.splice(i, 1);
  };
  if (stage("media")) {
    redo(/^(hero|gallery|frame)/);
    await ensureShowcase();
    console.log("Hero montage");
    heroMontage();
    console.log("Gallery");
    galleryGifs();
    siteMedia();
    frame();
  }
  if (
    only ? only.includes("niches") : !has("--skip-niches") && nichesRendered()
  ) {
    redo(/^(niche|montage)/);
    console.log("Niche showcase media");
    nicheMedia();
  } else if (!only && !has("--skip-niches")) {
    console.log(
      "Niche videos are not rendered yet: skipping them (npm run showcase -- --set niches)",
    );
  }
  if (stage("sheets")) {
    redo(/sheet$/);
    console.log("Theme and scene sheets");
    sheets();
  }
  if (stage("ui")) {
    redo(/^(screenshot|ui-|terminal|podcast)/);
    console.log("Screenshots, recording, MCP terminal");
    ui();
  }
  writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), files: manifest },
      null,
      2,
    ),
  );
  writeIndex();
  rmSync(WORK, { recursive: true, force: true });

  const over = manifest.filter((m) => m.cap && m.bytes > m.cap);
  for (const m of manifest)
    console.log(
      `${m.file.padEnd(40)} ${fmtMb(m.bytes).padStart(9)}${m.cap ? `  (cap ${fmtMb(m.cap)})` : ""}`,
    );
  if (over.length) {
    console.error(`Over the cap: ${over.map((m) => m.file).join(", ")}`);
    process.exit(1);
  }
  console.log(
    `\nWrote ${manifest.length} files to ${path.relative(".", OUT)}/. Open dist/demo/index.html.`,
  );

  const tag = value("--upload");
  if (tag) {
    const files = manifest.map((m) => path.join(OUT, m.file));
    execFileSync("gh", ["release", "upload", tag, ...files, "--clobber"], {
      stdio: "inherit",
    });
    console.log(`Uploaded ${files.length} files to release ${tag}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
