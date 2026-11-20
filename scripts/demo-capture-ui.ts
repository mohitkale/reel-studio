/**
 * The browser and terminal half of `npm run demo:assets` (roadmap L2).
 *
 * Starts a throwaway studio (its own data folder, a fake local writer, no
 * network), then with a real Chrome:
 *   - takes screenshots of the home page, the generation view and the result
 *     page, on desktop and on a phone, plus the four README screenshots;
 *   - records one prompt-to-video session (webm) with the times that matter;
 *   - runs the real MCP server over stdio, makes a video with it, and renders
 *     the exchange as a terminal recording (PNG frames).
 *
 *   node --import tsx scripts/demo-capture-ui.ts --out dist/demo/.work/ui [--screens-only]
 *
 * Nothing here is faked: the MCP lines are what the server returned.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readEngineInfo } from "../src/server/local-engine";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium, type Browser, type Page } from "@playwright/test";
import { z } from "zod";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = path.resolve(flag("--out") ?? "dist/demo/.work/ui");
const PORT = flag("--port") ?? "3190";
const WRITER_PORT = flag("--writer-port") ?? "3198";
const base = `http://127.0.0.1:${PORT}`;
const screensOnly = args.includes("--screens-only");
mkdirSync(out, { recursive: true });

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 4 * 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("The demo studio did not start");
}

function startStudio(): ChildProcess {
  return spawn(process.execPath, ["e2e/start-server.mjs"], {
    env: {
      ...process.env,
      E2E_PORT: PORT,
      E2E_WRITER_PORT: WRITER_PORT,
    },
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
}

async function setFakeWriter(page: Page): Promise<void> {
  await page.goto(`${base}/settings`);
  const status = await page.evaluate(async (port) => {
    const response = await fetch("/api/ai/local-config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: "ollama",
        config: {
          baseUrl: `http://127.0.0.1:${port}`,
          modelId: "fixture:latest",
          temperature: 0.2,
          allowLan: false,
        },
      }),
    });
    return response.status;
  }, WRITER_PORT);
  if (status !== 200)
    throw new Error(`Could not set the fake writer: ${status}`);
}

/** The first-run banner is its own journey; the home shots show the page as you use it. */
async function skipSetup(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "Skip setup" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page
      .getByText("Set up in under a minute")
      .waitFor({ state: "hidden", timeout: 15_000 });
    await page.waitForTimeout(400);
  }
}

/** Shows the Simple mode, which is what a first-time visitor sees. */
async function simpleMode(page: Page): Promise<void> {
  const simple = page.getByRole("button", { name: "Simple", exact: true });
  if (await simple.isVisible().catch(() => false)) await simple.click();
}

/** Puts the player on a frame with something in it (the first frame is empty). */
async function showFrame(page: Page, seconds: number): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>(
      'video[aria-label="Finished video"]',
    );
    return video && video.readyState >= HTMLMediaElement.HAVE_METADATA;
  });
  await page.getByLabel("Finished video").evaluate(
    (v, t) =>
      new Promise<void>((resolve) => {
        const video = v as HTMLVideoElement;
        video.pause();
        video.addEventListener("seeked", () => resolve(), { once: true });
        video.currentTime = t;
        setTimeout(resolve, 8000);
      }),
    seconds,
  );
  // Let the decoded frame reach the screen before it is photographed.
  await page.waitForTimeout(1200);
}

/** The dev server's corner badge is not part of the product. */
const HIDE_DEV_BADGE = () => {
  const style = document.createElement("style");
  style.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () =>
    document.head.appendChild(style),
  );
};

type PreviewWindow = Window & { __reelSeek?: (seconds: number) => void };

/** Seek the live editor and gallery previews to a settled frame before capturing. */
async function showPreviewFrames(page: Page, count: number): Promise<void> {
  const selector = 'iframe[title="HyperFrames preview"]';
  await page.waitForFunction(
    ({ selector, count }) => {
      const frames = Array.from(
        document.querySelectorAll<HTMLIFrameElement>(selector),
      );
      return (
        frames.length >= count &&
        frames
          .slice(0, count)
          .every(
            (frame) =>
              typeof (frame.contentWindow as PreviewWindow | null)
                ?.__reelSeek === "function",
          )
      );
    },
    { selector, count },
  );
  await page.locator(selector).evaluateAll(async (frames, count) => {
    for (const element of frames.slice(0, count)) {
      const frame = element as HTMLIFrameElement;
      await frame.contentDocument?.fonts.ready;
      (frame.contentWindow as PreviewWindow | null)?.__reelSeek?.(1.5);
    }
  }, count);
}

async function captureReadmeScreens(
  browser: Browser,
  resultUrl?: string,
): Promise<void> {
  const directory = path.join(out, "screens");
  mkdirSync(directory, { recursive: true });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await desktop.addInitScript(HIDE_DEV_BADGE);
  try {
    const page = await desktop.newPage();
    const capture = (name: string) =>
      page.screenshot({
        path: path.join(directory, `${name}.jpg`),
        type: "jpeg",
        quality: 84,
      });
    const headers = { origin: base, "content-type": "application/json" };
    const mode = await fetch(`${base}/api/ui-mode`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "simple", onboarded: true }),
    });
    if (!mode.ok)
      throw new Error(`Could not set the demo Studio mode: ${mode.status}`);
    await page.goto(`${base}/`);
    await page
      .getByRole("heading", { name: "What do you want to make?" })
      .waitFor();
    await page
      .locator("aside")
      .getByRole("link", { name: "Settings", exact: true })
      .waitFor();
    await page.locator("#one-prompt-input").fill("Why is the sky blue?");
    await capture("home");

    if (!resultUrl) {
      const response = await fetch(`${base}/api/storyboards?quality=draft`, {
        method: "POST",
        headers,
        body: readFileSync("e2e/fixtures/written.storyboard.json", "utf8"),
      });
      if (!response.ok)
        throw new Error(
          `Could not queue the README video: ${response.status} ${await response.text()}`,
        );
      const { jobId } = z
        .object({ jobId: z.string().min(1) })
        .parse(await response.json());
      resultUrl = `${base}/results/${encodeURIComponent(jobId)}`;
    }
    await page.goto(resultUrl);
    await page.getByText("Ready to download").waitFor({ timeout: 8 * 60_000 });
    await showFrame(page, 3);
    await capture("result");

    const editor = await page
      .getByRole("link", { name: "Open full editor" })
      .getAttribute("href");
    if (!editor) throw new Error("The README video has no editor link.");
    const editorUrl = new URL(editor, base);
    editorUrl.search = "";
    await page.goto(editorUrl.href);
    await showPreviewFrames(page, 1);
    await page
      .locator('iframe[title="HyperFrames preview"]')
      .first()
      .evaluate((frame) => frame.scrollIntoView({ block: "center" }));
    await capture("editor");

    await page.goto(`${base}/scenes`);
    await page
      .getByRole("heading", { name: "Scene types", exact: true })
      .waitFor();
    await showPreviewFrames(page, 4);
    await capture("scene-types");
  } finally {
    await desktop.close();
  }
}

interface McpLine {
  kind: "command" | "output";
  text: string;
  /** Seconds the real call took, for the caption of the recording. */
  seconds?: number;
}

/** Runs the real MCP server over stdio and returns what a person would see in a terminal. */
async function mcpSession(): Promise<McpLine[]> {
  const lines: McpLine[] = [];
  // The server finds or starts its own engine, as it does for a person. Give
  // it a throwaway data folder and database, so nothing of yours is touched.
  const home = path.join(out, "mcp-home");
  mkdirSync(home, { recursive: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    REEL_STUDIO_HOME: home,
    DATABASE_URL: `file:${path.join(home, "mcp.db")}`,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const migrate = spawnSync(
    process.execPath,
    ["scripts/migrate-database.mjs"],
    {
      env,
      stdio: "ignore",
    },
  );
  if (migrate.status !== 0)
    throw new Error("Could not migrate the MCP demo database");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["bin/reel-studio.mjs", "mcp"],
    env: env as Record<string, string>,
  });
  const LONG = { timeout: 8 * 60_000 };
  const client = new Client({ name: "demo-agent", version: "1.0.0" });
  await client.connect(transport);
  const timed = async <T>(run: () => Promise<T>) => {
    const started = Date.now();
    const value = await run();
    return { value, seconds: (Date.now() - started) / 1000 };
  };
  try {
    lines.push({ kind: "command", text: "node bin/reel-studio.mjs mcp" });
    const server = client.getServerVersion();
    lines.push({
      kind: "output",
      text: `connected: ${server?.name ?? "reel-studio"} ${server?.version ?? ""}`.trim(),
    });

    const tools = await timed(() => client.listTools(undefined, LONG));
    const names = tools.value.tools.map((t) => t.name);
    lines.push({ kind: "command", text: "agent> list the tools" });
    lines.push({
      kind: "output",
      text: `${names.length} tools: ${names.slice(0, 8).join(", ")}`,
      seconds: tools.seconds,
    });

    const storyboard = JSON.parse(
      readFileSync("e2e/fixtures/written.storyboard.json", "utf8"),
    ) as { title: string; scenes: unknown[] };
    lines.push({
      kind: "command",
      text: `agent> create_video "${storyboard.title}" (${storyboard.scenes.length} scenes, storyboard JSON)`,
    });
    const created = await timed(() =>
      client.callTool(
        {
          name: "create_video",
          arguments: { storyboard, quality: "draft" },
        },
        undefined,
        LONG,
      ),
    );
    const createdText = JSON.stringify(created.value.content ?? "");
    const jobId =
      /"jobId"\s*:\s*"([^"\\]+)/.exec(createdText.replace(/\\"/g, '"'))?.[1] ??
      /\bjob[ _-]?id[^A-Za-z0-9]+([A-Za-z0-9]{8,})/i.exec(createdText)?.[1];
    lines.push({
      kind: "output",
      text: jobId ? `queued job ${jobId}` : "queued",
      seconds: created.seconds,
    });

    if (jobId) {
      const deadline = Date.now() + 10 * 60_000;
      let last = "";
      while (Date.now() < deadline) {
        const status = await timed(() =>
          client.callTool(
            { name: "get_job", arguments: { jobId } },
            undefined,
            LONG,
          ),
        );
        const body = JSON.stringify(status.value.content ?? "").replace(
          /\\"/g,
          '"',
        );
        const state = /"state"\s*:\s*"([a-z_]+)"/.exec(body)?.[1] ?? "?";
        if (state !== last) {
          lines.push({ kind: "command", text: `agent> get_job ${jobId}` });
          lines.push({
            kind: "output",
            text: state,
            seconds: status.seconds,
          });
          last = state;
        }
        if (["succeeded", "failed", "canceled"].includes(state)) {
          const file = /(\/media\/renders\/[^"\\\s]+\.mp4)/.exec(body)?.[1];
          if (file) lines.push({ kind: "output", text: `video: ${file}` });
          break;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  } finally {
    await client.close().catch(() => undefined);
    // The engine it started keeps running on its own; stop it with the demo.
    const engine = readEngineInfo(home);
    if (engine?.pid) {
      try {
        process.kill(-engine.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
  return lines;
}

/** The example podcast storyboard, made into an episode by the studio; saved as episode.wav. */
async function podcastEpisode(): Promise<void> {
  const body = readFileSync("examples/storyboards/podcast.json", "utf8");
  const queued = await fetch(`${base}/api/storyboards`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body,
  });
  if (queued.status !== 202)
    throw new Error(
      `The podcast storyboard was refused: ${queued.status} ${await queued.text()}`,
    );
  const { jobId, podcastId } = (await queued.json()) as {
    jobId: string;
    podcastId: string;
  };
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const job = (
      (await (
        await fetch(`${base}/api/podcasts/${podcastId}/takes/${jobId}`)
      ).json()) as {
        job: {
          status: string;
          error: string | null;
          podcastTake: { audioUrl: string } | null;
        };
      }
    ).job;
    if (job.status === "error")
      throw new Error(job.error ?? "The podcast episode failed");
    if (job.status === "done" && job.podcastTake) {
      const wav = await fetch(`${base}${job.podcastTake.audioUrl}`);
      writeFileSync(
        path.join(out, "episode.wav"),
        Buffer.from(await wav.arrayBuffer()),
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("The podcast episode did not finish in time");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Draws the exchange as terminal frames: each command typed, each answer shown. */
async function renderTerminal(page: Page, lines: McpLine[]): Promise<void> {
  const frames = path.join(out, "terminal");
  mkdirSync(frames, { recursive: true });
  await page.setViewportSize({ width: 960, height: 420 });
  const shown: string[] = [];
  const draw = async (typing?: string) => {
    const body = [...shown, ...(typing === undefined ? [] : [typing])]
      .map((l) => `<div>${l}</div>`)
      .join("");
    await page.setContent(
      `<body style="margin:0;background:#0f1419"><div style="padding:18px 22px;font:15px/1.55 ui-monospace,Menlo,monospace;color:#d6deeb;height:384px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end">${body}<span style="display:inline-block;width:9px;height:17px;background:#d6deeb;vertical-align:-3px"></span></div></body>`,
    );
  };
  const timeline: Array<{ file: string; seconds: number }> = [];
  let n = 0;
  const snap = async (seconds: number) => {
    const file = path.join(frames, `t-${String(n++).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    timeline.push({ file, seconds });
  };
  for (const line of lines) {
    if (line.kind === "command") {
      const prompt = line.text.startsWith("agent>")
        ? `<span style="color:#7fdbca">agent&gt;</span> `
        : `<span style="color:#c792ea">$</span> `;
      const text = line.text.replace(/^agent>\s*/, "");
      // Typing in four steps keeps the file small and still reads as typing.
      for (const part of [0.25, 0.5, 0.75]) {
        await draw(prompt + esc(text.slice(0, Math.ceil(text.length * part))));
        await snap(0.12);
      }
      shown.push(prompt + esc(text));
      await draw();
      await snap(0.5);
    } else {
      const suffix =
        line.seconds !== undefined && line.seconds >= 0.05
          ? ` <span style="color:#637777">(${line.seconds.toFixed(1)} s)</span>`
          : "";
      shown.push(
        `<span style="color:#addb67">${esc(line.text)}</span>${suffix}`,
      );
      await draw();
      await snap(0.9);
    }
  }
  timeline[timeline.length - 1]!.seconds = 3;
  writeFileSync(
    path.join(frames, "frames.txt"),
    timeline
      .map((t) => `file '${t.file}'\nduration ${t.seconds}`)
      .concat(`file '${timeline[timeline.length - 1]!.file}'`)
      .join("\n"),
  );
  writeFileSync(
    path.join(out, "mcp-transcript.json"),
    JSON.stringify(lines, null, 2),
  );
}

async function main(): Promise<void> {
  const studio = startStudio();
  const stop = () => {
    try {
      if (process.platform === "win32") studio.kill("SIGTERM");
      else process.kill(-studio.pid!, "SIGTERM");
    } catch {
      // Already gone.
    }
  };
  process.on("exit", stop);
  try {
    await waitForServer();
    const browser = await chromium.launch({
      channel: process.env.E2E_BROWSER ?? "chrome",
    });

    if (screensOnly) {
      try {
        await captureReadmeScreens(browser);
      } finally {
        await browser.close();
      }
      return;
    }

    // 1. Desktop session, recorded.
    const recordings = path.join(out, "recording");
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: recordings, size: { width: 1280, height: 800 } },
    });
    await desktop.addInitScript(HIDE_DEV_BADGE);
    const page = await desktop.newPage();
    const startedAt = Date.now();
    const at = () => (Date.now() - startedAt) / 1000;
    const marks: Record<string, number> = {};
    await setFakeWriter(page);
    await page.goto(`${base}/`);
    await page
      .getByRole("heading", { name: "What do you want to make?" })
      .waitFor();
    await skipSetup(page);
    await page.screenshot({ path: path.join(out, "ui-home.png") });
    marks.homeShown = at();
    const prompt = page.locator("#one-prompt-input");
    await prompt.click();
    await page.keyboard.type("Why the sky is blue", { delay: 70 });
    await page.getByText("More options").first().click();
    await page.getByLabel(/Quick draft/).check();
    await page.waitForTimeout(600);
    marks.beforeCreate = at();
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/results\//);
    await page.getByText(/Making your video/).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, "ui-generation.png") });
    marks.generationShown = at();
    await page.getByText("Ready to download").waitFor({ timeout: 8 * 60_000 });
    await page.getByLabel("Finished video").waitFor();
    await simpleMode(page);
    await showFrame(page, 3);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, "ui-result.png") });
    marks.resultShown = at();
    await page.waitForTimeout(2500);
    marks.end = at();
    const resultUrl = page.url();
    const video = page.video();
    await desktop.close();
    const recorded = await video?.path();
    if (recorded) renameSync(recorded, path.join(out, "ui-recording.webm"));
    writeFileSync(path.join(out, "ui-recording.json"), JSON.stringify(marks));

    // 2. The same pages on a phone.
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await phone.addInitScript(HIDE_DEV_BADGE);
    const mobile = await phone.newPage();
    await mobile.goto(`${base}/`);
    await mobile
      .getByRole("heading", { name: "What do you want to make?" })
      .waitFor();
    await skipSetup(mobile);
    await mobile.screenshot({ path: path.join(out, "ui-home-mobile.png") });
    await mobile.goto(resultUrl);
    await mobile.getByText("Ready to download").waitFor({ timeout: 60_000 });
    await simpleMode(mobile);
    await showFrame(mobile, 3);
    await mobile.screenshot({ path: path.join(out, "ui-result-mobile.png") });
    await phone.close();
    await captureReadmeScreens(browser, resultUrl);

    // 3. The MCP flow, from the real server, drawn as a terminal.
    const lines = await mcpSession();
    const terminal = await browser.newContext({
      viewport: { width: 960, height: 420 },
    });
    await renderTerminal(await terminal.newPage(), lines);
    await terminal.close();
    await browser.close();

    // 4. The example podcast, for the website gallery.
    await podcastEpisode();
  } finally {
    stop();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
