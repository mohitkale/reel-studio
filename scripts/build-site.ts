/**
 * `npm run site:build`: the project website (roadmap L3), written to `dist/site/`.
 *
 *   npm run site:build [-- --media-base <url>] [-- --site-url <url>]
 *
 * Pages: the landing page, the gallery (every golden storyboard with its video and its
 * JSON), the MCP install page, and the guides in `docs/` rendered as HTML. Plain HTML
 * and one stylesheet; the only script copies code to the clipboard. No analytics, no
 * third-party requests: videos and images come from `--media-base` (default: the
 * `demo-assets` release that `npm run demo:assets` fills).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { escapeHtml, renderMarkdown } from "../src/site/markdown";

const argv = process.argv.slice(2);
const value = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const REPO = "https://github.com/mohitkale/reel-studio";
const MEDIA = (
  value("--media-base") ?? `${REPO}/releases/download/demo-assets`
).replace(/\/$/, "");
const SITE_URL = (
  value("--site-url") ?? "https://mohitkale.github.io/reel-studio/"
).replace(/\/?$/, "/");
const OUT = path.resolve("dist/site");
/** Posters are small and first on screen, so they are served from the site itself when a folder of them is given. */
const POSTER_DIR = value("--poster-dir");
const poster = (file: string, root: string): string =>
  POSTER_DIR ? `${root}media/${file}` : `${MEDIA}/${file}`;

/** What the gallery shows, in order, with one line each. */
const GALLERY: Array<{ name: string; blurb: string }> = [
  {
    name: "listicle",
    blurb:
      "A list that holds attention: five shortcuts, one per scene, with the keys on screen.",
  },
  {
    name: "product-launch",
    blurb: "A product launch: the claim, the proof, the call to action.",
  },
  { name: "how-to", blurb: "A how-to: numbered steps, one idea at a time." },
  {
    name: "explainer",
    blurb: "An explainer in landscape: a question, the answer, a diagram.",
  },
  {
    name: "data-story",
    blurb:
      "Numbers as a story: a chart that builds as the narration reaches it.",
  },
  {
    name: "developer-demo",
    blurb: "A developer demo: a terminal, real commands, a clear ending.",
  },
  {
    name: "comparison",
    blurb: "A comparison: two options side by side, scene by scene.",
  },
  { name: "motivation", blurb: "A short quote reel: one line, one breath." },
  {
    name: "myth-vs-fact",
    blurb: "Myth versus fact: the claim, the correction, the source.",
  },
  {
    name: "news-recap",
    blurb: "A news recap: headlines and the facts behind them.",
  },
  {
    name: "story",
    blurb: "A story told in scenes, with a narrator and music.",
  },
  {
    name: "podcast",
    blurb: "A two-host podcast: a script in, a mastered episode out.",
  },
];

/** Guides, in reading order; the first is the index. */
const DOCS: Array<{ file: string; title: string; group: string }> = [
  { file: "GETTING_STARTED", title: "Getting started", group: "Use it" },
  { file: "CREATING_VIDEOS", title: "Creating videos", group: "Use it" },
  { file: "PODCASTS", title: "Podcasts and audio", group: "Use it" },
  { file: "LOCAL_AI", title: "Local AI", group: "Use it" },
  { file: "VOICE_PROVIDERS", title: "Voice providers", group: "Use it" },
  { file: "MCP", title: "MCP", group: "Use it" },
  { file: "CLI", title: "Command line", group: "Use it" },
  { file: "STORYBOARD", title: "Storyboard", group: "Use it" },
  { file: "SCENES_AND_THEMES", title: "Scenes and themes", group: "Use it" },
  { file: "QUALITY", title: "Quality", group: "Use it" },
  { file: "TROUBLESHOOTING", title: "Troubleshooting", group: "Use it" },
  { file: "ARCHITECTURE", title: "Architecture", group: "Build on it" },
  {
    file: "CONTRIBUTING_PRESENTERS",
    title: "Contributing presenters",
    group: "Build on it",
  },
  {
    file: "CONTRIBUTING_SCENES",
    title: "Contributing scenes",
    group: "Build on it",
  },
  { file: "FEATURES", title: "Feature inventory", group: "Build on it" },
  { file: "LICENSING", title: "Licensing", group: "Build on it" },
];
const docNames = new Set(DOCS.map((d) => d.file));

const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#6d5dfc"/><rect x="8" y="9" width="16" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M13 13l7 3-7 3z" fill="#fff"/></svg>',
  );

const e = escapeHtml;

function layout(args: {
  title: string;
  description: string;
  /** Path of the page inside the site, for the canonical URL and the nav. */
  page: string;
  body: string;
  nav?: "home" | "gallery" | "mcp" | "docs";
  video?: boolean;
  /** An image that is the first thing on screen; the browser is told to fetch it early. */
  preload?: string;
}): string {
  const depth = args.page.split("/").length - 1;
  const root = depth === 0 ? "" : "../".repeat(depth);
  const url = SITE_URL + args.page.replace(/index\.html$/, "");
  const link = (href: string, label: string, key: string) =>
    `<a href="${root}${href}"${args.nav === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(args.title)}</title>
<meta name="description" content="${e(args.description)}">
<link rel="canonical" href="${e(url)}">
<link rel="icon" href="${ICON}">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Reel Studio">
<meta property="og:title" content="${e(args.title)}">
<meta property="og:description" content="${e(args.description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(SITE_URL)}assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Reel Studio: type an idea, get a finished short video or podcast, free, on your own computer.">
${args.video ? `<meta property="og:video" content="${e(MEDIA)}/hero.mp4">\n<meta property="og:video:type" content="video/mp4">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${root}style.css">
${args.preload ? `<link rel="preload" as="image" href="${e(args.preload)}" fetchpriority="high">` : ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${root}index.html"><span class="logo" aria-hidden="true"></span>Reel Studio</a>
  <nav aria-label="Main">
    ${link("gallery.html", "Gallery", "gallery")}
    ${link("docs/index.html", "Docs", "docs")}
    ${link("mcp.html", "Use with an agent", "mcp")}
    <a href="${REPO}">GitHub</a>
  </nav>
</header>
<main id="main">
${args.body}
</main>
<footer class="foot">
  <p>Reel Studio is free software (MIT). It runs on your computer; this site sets no cookies and has no analytics.</p>
  <p><a href="${REPO}">Source</a> · <a href="${REPO}/issues">Issues</a> · <a href="${root}docs/LICENSING.html">Licensing</a> · <a href="${REPO}/blob/main/SECURITY.md">Security</a></p>
</footer>
<script src="${root}site.js" defer></script>
</body>
</html>
`;
}

/** A code block with a Copy button (the script adds the behaviour). */
function codeBlock(code: string, label = "Copy"): string {
  return `<div class="code"><button type="button" class="copy" data-copy>${label}</button><pre><code>${e(code)}</code></pre></div>`;
}

function landing(): string {
  const tiles = GALLERY.slice(0, 6)
    .map(
      ({ name }) =>
        `<a class="tile" href="gallery.html#${name}"><img src="${poster(`gallery-${name}.jpg`, "")}" alt="${e(storyboardTitle(name))}" width="320" height="568" loading="lazy" decoding="async"><span>${e(storyboardTitle(name))}</span></a>`,
    )
    .join("");
  return `
<section class="hero">
  <div class="hero-text">
    <h1>Type an idea. Get a finished short video or podcast.</h1>
    <p class="lead">Free, and on your own computer. An AI model (or you) writes one small JSON file; voice, scenes, captions, music and the MP4 are made locally, the same way every time.</p>
    <p class="cta"><a class="button" href="#try-it">Try it</a> <a class="button ghost" href="gallery.html">See what it makes</a></p>
  </div>
  <video class="hero-video" width="1080" height="640" controls muted loop playsinline preload="none" poster="${poster("hero-poster.jpg", "")}" aria-label="Three videos made by Reel Studio, side by side">
    <source src="${MEDIA}/hero.webm" type="video/webm">
    <source src="${MEDIA}/hero.mp4" type="video/mp4">
  </video>
</section>

<section class="band">
  <h2>How it works</h2>
  <img class="diagram" src="assets/how-it-works.svg" width="900" height="250" alt="An idea becomes a storyboard, the only AI step. Voice, scenes, captions and music are then made on your machine and rendered to an MP4.">
  <p>The storyboard is plain JSON: <a href="docs/STORYBOARD.html">the format is documented</a> and has a JSON Schema. Nothing after it needs a cloud service or a per-video fee.</p>
</section>

<section class="band">
  <h2>What it makes</h2>
  <p>Every video here comes from a short file in <a href="${REPO}/tree/main/examples/storyboards">examples/storyboards</a>.</p>
  <div class="tiles">${tiles}</div>
  <p><a href="gallery.html">All twelve, with their storyboards</a></p>
</section>

<section class="band" id="try-it">
  <h2>Try it</h2>
  <p>Needs Node 24 LTS, FFmpeg and Chrome. No account and no API key.</p>
  ${codeBlock("git clone https://github.com/mohitkale/reel-studio.git\ncd reel-studio\nnpm ci && npm run setup && npm run dev")}
  <p>Open <code>localhost:3000</code>, type what you want to make, press <strong>Create</strong>. An <code>npx reel-studio</code> one-liner is planned; it is not published yet. <a href="docs/GETTING_STARTED.html">Getting started</a>.</p>
</section>

<section class="band">
  <h2>Use it from your agent</h2>
  <p>Add the server to Claude Code, Cursor, Codex or any MCP client and ask for a video.</p>
  ${codeBlock("claude mcp add reel-studio -- node /path/to/reel-studio/bin/reel-studio.mjs mcp")}
  <p><a href="mcp.html">Setup for each client</a>, including what has and has not been checked.</p>
</section>

<section class="band">
  <h2>Local first</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Step</th><th>Runs on your computer</th><th>Optional cloud</th></tr></thead>
    <tbody>
      <tr><td>Writing the storyboard</td><td>You, Ollama, LM Studio, llama.cpp</td><td>Gemini, OpenAI</td></tr>
      <tr><td>Voice</td><td>Kokoro</td><td>ElevenLabs, Cartesia</td></tr>
      <tr><td>Video, captions, music</td><td>Always local</td><td>None</td></tr>
      <tr><td>Stock footage</td><td>Your uploads</td><td>Pexels, Pixabay, Unsplash</td></tr>
    </tbody>
  </table></div>
  <p>Projects and outputs stay on your machine; a provider sees data only if you turn it on.</p>
</section>

<section class="band">
  <h2>What it is and is not</h2>
  <p>It makes <strong>motion-graphics videos</strong>: text, charts, quotes, lists and code on animated scenes, with a voice, captions and music. It is free, local and repeatable. It does <strong>not</strong> make talking avatars of real people or generated footage of invented scenes; for those, use a tool built for them. You can still bring your own clips.</p>
</section>

<section class="band join">
  <h2>Join in</h2>
  <p>Reel Studio is open source and built in the open. If it is useful to you, a star helps others find it; if you want to change it, fork it.</p>
  <p class="cta"><a class="button" href="${REPO}">Star on GitHub</a> <a class="button ghost" href="${REPO}/fork">Fork it</a> <a class="button ghost" href="${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22">Good first issues</a></p>
  <p>New scene types, themes and example storyboards are each one small folder or file: <a href="docs/CONTRIBUTING_SCENES.html">how to add one</a>. The plan to v1.0 is in the <a href="${REPO}/issues/140">roadmap issue</a>.</p>
</section>`;
}

const storyboards = new Map<
  string,
  { raw: string; json: Record<string, unknown> }
>();
function storyboard(name: string) {
  let found = storyboards.get(name);
  if (!found) {
    const raw = readFileSync(
      path.resolve("examples/storyboards", `${name}.json`),
      "utf8",
    );
    found = { raw, json: JSON.parse(raw) as Record<string, unknown> };
    storyboards.set(name, found);
  }
  return found;
}
function storyboardTitle(name: string): string {
  return String(storyboard(name).json.title ?? name);
}

function gallery(): string {
  const cards = GALLERY.map(({ name, blurb }) => {
    const { raw, json } = storyboard(name);
    const isPodcast = json.kind === "podcast";
    const scenes = Array.isArray(json.scenes)
      ? json.scenes.length
      : Array.isArray(json.turns)
        ? json.turns.length
        : 0;
    const format = isPodcast ? "audio" : String(json.format ?? "9:16");
    const portrait = format === "9:16";
    const media = isPodcast
      ? `<audio controls preload="none" src="${MEDIA}/gallery-podcast.mp3" aria-label="${e(storyboardTitle(name))}"></audio>`
      : `<video controls preload="none" playsinline poster="${poster(`gallery-${name}.jpg`, "")}" src="${MEDIA}/gallery-${name}.mp4" class="${portrait ? "portrait" : format === "1:1" ? "square" : "wide"}" aria-label="${e(storyboardTitle(name))}"></video>`;
    return `
<article class="card" id="${name}">
  <div class="card-media">${media}</div>
  <div class="card-body">
    <h2>${e(storyboardTitle(name))}</h2>
    <p class="meta">${isPodcast ? "Podcast" : "Video"} · ${e(format)} · ${scenes} ${isPodcast ? "turns" : "scenes"}</p>
    <p>${e(blurb)}</p>
    <details open>
      <summary>Its storyboard (JSON)</summary>
      <div class="code"><button type="button" class="copy" data-copy>Copy</button><pre tabindex="0" aria-label="Storyboard JSON for ${e(storyboardTitle(name))}"><code>${e(raw.trim())}</code></pre></div>
      <p><a href="${REPO}/blob/main/examples/storyboards/${name}.json">Raw file on GitHub</a></p>
    </details>
  </div>
</article>`;
  }).join("\n");
  return `
<section class="page-head">
  <h1>Gallery</h1>
  <p class="lead">The twelve example storyboards in the repository, each made into a video (or an episode) by Reel Studio. The JSON beside each is all that was written; everything else was made on a computer.</p>
</section>
<div class="cards">
${cards}
</div>`;
}

const CLIENTS: Array<{
  name: string;
  where: string;
  snippet: string;
  lang: string;
}> = [
  {
    name: "Claude Code",
    where: "run once in a terminal",
    lang: "bash",
    snippet:
      "claude mcp add reel-studio -- node /path/to/reel-studio/bin/reel-studio.mjs mcp",
  },
  {
    name: "Claude Desktop, Cursor, Windsurf, Gemini CLI",
    where: "an mcpServers object in the client's MCP settings file",
    lang: "json",
    snippet: JSON.stringify(
      {
        mcpServers: {
          "reel-studio": {
            command: "node",
            args: ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"],
          },
        },
      },
      null,
      2,
    ),
  },
  {
    name: "Codex CLI",
    where: "~/.codex/config.toml",
    lang: "toml",
    snippet:
      '[mcp_servers.reel-studio]\ncommand = "node"\nargs = ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"]',
  },
  {
    name: "VS Code",
    where: ".vscode/mcp.json",
    lang: "json",
    snippet: JSON.stringify(
      {
        servers: {
          "reel-studio": {
            type: "stdio",
            command: "node",
            args: ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"],
          },
        },
      },
      null,
      2,
    ),
  },
];

function mcpPage(): string {
  const blocks = CLIENTS.map(
    (c) => `
<section class="band">
  <h2>${e(c.name)}</h2>
  <p>${e(c.where)}</p>
  ${codeBlock(c.snippet)}
</section>`,
  ).join("\n");
  return `
<section class="page-head">
  <h1>Use Reel Studio from your agent</h1>
  <p class="lead">Add the server, then ask your agent for a video. The first call finds a studio engine on your computer or starts one in the background. Nothing else to set up, no token, nothing leaves the machine unless you turn a cloud provider on.</p>
  <p>Replace <code>/path/to/reel-studio</code> with where you cloned the repository. Once the package is published this becomes <code>npx -y reel-studio mcp</code>; it is not published yet.</p>
</section>
${blocks}
<section class="band">
  <h2>What has been checked</h2>
  <p>The server itself was run with the MCP SDK's stdio client on macOS (17 Nov 2026). The configuration shapes above come from each client's own documentation, and <strong>none of them has been run against a real install of that client yet</strong>. If one does not work for you, <a href="${REPO}/issues">please open an issue</a> with what the client printed.</p>
  <p>Eight core tools are on by default: create_video, create_podcast, get_job, list_options, list_videos, open_studio, review_video and revise_video. The rest are opt-in. <a href="docs/MCP.html">Full MCP guide</a>.</p>
</section>`;
}

/** Maps a link in a guide to where it lives on the site, or on GitHub when the site has no such page. */
function docLink(from: string) {
  return (href: string): string => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const [target, hash = ""] = href.split("#");
    const suffix = hash ? `#${hash}` : "";
    const resolved = path.posix.normalize(path.posix.join("docs", target!));
    const mdName = /^docs\/([A-Z_]+)\.md$/.exec(resolved)?.[1];
    if (mdName && docNames.has(mdName)) return `${mdName}.html${suffix}`;
    if (resolved === "docs/README.md") return `index.html${suffix}`;
    if (resolved === "README.md") return `../index.html${suffix}`;
    if (/\.(png|jpe?g|gif|svg|webp)$/.test(resolved) && from)
      return `https://raw.githubusercontent.com/mohitkale/reel-studio/main/${resolved}`;
    return `${REPO}/blob/main/${resolved}${suffix}`;
  };
}

function docsSidebar(current: string): string {
  const groups = ["Use it", "Build on it"];
  return `<nav class="side" aria-label="Guides">
${groups
  .map(
    (g) =>
      `<h2>${g}</h2><ul>${DOCS.filter((d) => d.group === g)
        .map(
          (d) =>
            `<li><a href="${d.file}.html"${d.file === current ? ' aria-current="page"' : ""}>${e(d.title)}</a></li>`,
        )
        .join("")}</ul>`,
  )
  .join("\n")}
</nav>`;
}

function docPage(file: string, title: string): string {
  const md = readFileSync(path.resolve("docs", `${file}.md`), "utf8");
  const description = (
    /^[A-Za-z][^\n#|`>-].{40,}/m.exec(md.replace(/^#.*\n/, ""))?.[0] ?? title
  ).slice(0, 200);
  return layout({
    title: `${title} · Reel Studio`,
    description,
    page: `docs/${file}.html`,
    nav: "docs",
    body: `<div class="doc-layout">${docsSidebar(file)}<article class="doc">${renderMarkdown(md, { link: docLink(file) })}<p class="edit"><a href="${REPO}/edit/main/docs/${file}.md">Edit this page on GitHub</a></p></article></div>`,
  });
}

function docsIndex(): string {
  const md = readFileSync(path.resolve("docs/README.md"), "utf8");
  return layout({
    title: "Documentation · Reel Studio",
    description:
      "Guides for making videos and podcasts, using Reel Studio from an agent, and building on it.",
    page: "docs/index.html",
    nav: "docs",
    body: `<div class="doc-layout">${docsSidebar("")}<article class="doc">${renderMarkdown(md, { link: docLink("README") })}</article></div>`,
  });
}

function write(rel: string, content: string): void {
  const file = path.join(OUT, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** Fails the build when a page links to a page, file or heading on this site that does not exist. */
function checkLinks(): void {
  const pages = readdirSync(OUT, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"));
  const ids = new Map<string, Set<string>>();
  const html = new Map<string, string>();
  for (const page of pages) {
    const text = readFileSync(path.join(OUT, page), "utf8");
    html.set(page, text);
    ids.set(
      page,
      new Set([...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!)),
    );
  }
  const broken: string[] = [];
  for (const [page, text] of html) {
    for (const m of text.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const href = m[1]!;
      if (/^(https?:|mailto:|data:)/.test(href)) continue;
      const [target, hash] = href.split("#");
      const file = target
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(page), target),
          )
        : page;
      if (!existsSync(path.join(OUT, file))) {
        broken.push(`${page}: ${href} (no such file)`);
      } else if (hash && file.endsWith(".html") && !ids.get(file)?.has(hash)) {
        broken.push(`${page}: ${href} (no such heading)`);
      }
    }
  }
  if (broken.length) {
    console.error(`Broken links on the site:\n${broken.join("\n")}`);
    process.exit(1);
  }
}

function main(): void {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(path.resolve("site"), OUT, { recursive: true });
  cpSync(
    path.resolve("docs/assets/how-it-works.svg"),
    path.join(OUT, "assets/how-it-works.svg"),
  );
  if (POSTER_DIR)
    cpSync(path.resolve(POSTER_DIR), path.join(OUT, "media"), {
      recursive: true,
    });

  write(
    "index.html",
    layout({
      title: "Reel Studio: type an idea, get a finished short video or podcast",
      description:
        "A free, local-first video and podcast factory. An AI model or you writes a small JSON storyboard; voice, scenes, captions, music and the MP4 are made on your own computer.",
      page: "index.html",
      body: landing(),
      nav: "home",
      video: true,
      preload: poster("hero-poster.jpg", ""),
    }),
  );
  write(
    "gallery.html",
    layout({
      title: "Gallery · Reel Studio",
      description:
        "Twelve example storyboards, each made into a video or podcast episode by Reel Studio, with the JSON that produced it.",
      page: "gallery.html",
      body: gallery(),
      nav: "gallery",
    }),
  );
  write(
    "mcp.html",
    layout({
      title: "Use Reel Studio from your agent · Reel Studio",
      description:
        "Add the Reel Studio MCP server to Claude Code, Cursor, Codex, VS Code and other clients and ask for a video.",
      page: "mcp.html",
      body: mcpPage(),
      nav: "mcp",
    }),
  );
  write("docs/index.html", docsIndex());
  for (const d of DOCS) write(`docs/${d.file}.html`, docPage(d.file, d.title));
  const pages = [
    "index.html",
    "gallery.html",
    "mcp.html",
    "docs/index.html",
    ...DOCS.map((d) => `docs/${d.file}.html`),
  ];
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${SITE_URL}${p.replace(/index\.html$/, "")}</loc></url>`).join("\n")}\n</urlset>\n`,
  );
  write(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`,
  );
  write(".nojekyll", "");
  checkLinks();
  const count = readdirSync(OUT, { recursive: true }).filter((f) =>
    String(f).endsWith(".html"),
  ).length;
  console.log(
    `Wrote ${count} pages to ${path.relative(".", OUT)}/ (media from ${MEDIA}).`,
  );
  if (!existsSync(path.resolve("site/assets/og.png")))
    console.warn(
      "site/assets/og.png is missing: link previews will have no image.",
    );
}

main();
