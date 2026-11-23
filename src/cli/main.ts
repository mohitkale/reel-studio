/**
 * `reel-studio` command line (roadmap M7): lint, schema, examples and render.
 * Rendering talks to a running studio engine (REEL_STUDIO_URL, default
 * http://127.0.0.1:3000); linting and the schema need nothing running.
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { lintStoryboard } from "@/storyboard";
import { ensureEngine } from "../../mcp/src/engine";

import {
  applyOverrides,
  defaultOutputName,
  describeErrors,
  EXIT,
  parseRenderArgs,
  progressLine,
  UsageError,
} from "./core";

const root = path.resolve(import.meta.dirname, "..", "..");
const HELP = `reel-studio: storyboard in, video out

  reel-studio render <file|-> [-o out.mp4] [--format 9:16|16:9|1:1] [--theme id]
                     [--quality draft|standard|high] [--no-voice] [--json]
  reel-studio lint <file|->        check a storyboard (exit 2 when invalid)
  reel-studio schema               print the Storyboard v1 JSON Schema
  reel-studio examples             copy the example storyboards here
  reel-studio doctor [--fix [--yes]]  check FFmpeg, Chrome, voice model; --fix downloads what is missing (asks first)
  reel-studio mcp                  MCP server on stdio; starts the local engine if needed

Exit codes: 0 done, 1 usage, 2 invalid storyboard, 3 engine not running or
missing dependency, 4 render failed. REEL_STUDIO_URL points at the engine.`;

function readInput(file: string): string {
  return file === "-"
    ? readFileSync(0, "utf8")
    : readFileSync(path.resolve(file), "utf8");
}

function parseJson(text: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not valid JSON" };
  }
}

const base = () =>
  (process.env.REEL_STUDIO_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    origin: base(),
    ...(process.env.REEL_STUDIO_MCP_TOKEN
      ? { authorization: `Bearer ${process.env.REEL_STUDIO_MCP_TOKEN}` }
      : {}),
  };
}

async function engineUp(): Promise<boolean> {
  try {
    await fetch(`${base()}/api/production-presets`, {
      headers: headers(),
      signal: AbortSignal.timeout(4000),
    });
    return true;
  } catch {
    return false;
  }
}

interface JobView {
  state: string;
  progress?: number;
  error?: string | null;
  steps?: Array<{ key: string; state: string }>;
  outputs?: Array<{ id: string; kind: string }>;
}

async function lintCommand(rest: string[]): Promise<number> {
  const json = rest.includes("--json");
  const file = rest.find((a) => a === "-" || !a.startsWith("--"));
  if (!file) throw new UsageError("Give a storyboard file, or - for stdin");
  const parsed = parseJson(readInput(file));
  if (parsed.error) {
    console.error(`✗ Not valid JSON: ${parsed.error}`);
    return EXIT.invalid;
  }
  const lint = lintStoryboard(parsed.value);
  if (json) console.log(JSON.stringify(lint));
  if (!lint.storyboard) {
    if (!json) console.error(describeErrors(lint).join("\n"));
    return EXIT.invalid;
  }
  if (!json) {
    for (const fix of lint.fixes) console.log(`~ ${fix.path}: ${fix.message}`);
    for (const w of lint.warnings) console.log(`! ${w.path}: ${w.message}`);
    console.log("✓ Valid storyboard");
  }
  return EXIT.ok;
}

async function renderCommand(
  rest: string[],
  installed = false,
): Promise<number> {
  const args = parseRenderArgs(rest);
  const say = (event: Record<string, unknown>, text?: string) => {
    if (args.json) console.log(progressLine(event));
    else if (text) console.error(text);
  };
  const parsed = parseJson(readInput(args.file));
  if (parsed.error) {
    say(
      { event: "invalid", error: parsed.error },
      `✗ Not valid JSON: ${parsed.error}`,
    );
    return EXIT.invalid;
  }
  const storyboard = applyOverrides(parsed.value, args);
  const lint = lintStoryboard(storyboard);
  if (!lint.storyboard) {
    say(
      { event: "invalid", errors: lint.errors },
      describeErrors(lint).join("\n"),
    );
    return EXIT.invalid;
  }
  if (installed && !process.env.REEL_STUDIO_URL) {
    const engine = await ensureEngine(
      (message) => console.error(message),
      "user",
    );
    process.env.REEL_STUDIO_URL = engine.baseUrl;
    process.env.REEL_STUDIO_MCP_TOKEN = engine.secret;
  }
  if (!(await engineUp())) {
    say(
      { event: "missing", dependency: "engine", url: base() },
      `✗ The Reel Studio engine is not running at ${base()}.\n  Start it with "npm run dev" (or set REEL_STUDIO_URL).`,
    );
    return EXIT.missing;
  }

  say({ event: "queued" }, "→ Sending the storyboard");
  const post = await fetch(
    `${base()}/api/storyboards?${new URLSearchParams({ quality: args.quality })}`,
    { method: "POST", headers: headers(), body: JSON.stringify(storyboard) },
  );
  const queued = (await post.json().catch(() => ({}))) as {
    jobId?: string;
    error?: string;
  };
  if (!queued.jobId) {
    say(
      { event: "failed", error: queued.error ?? `HTTP ${post.status}` },
      `✗ ${queued.error ?? `The engine answered HTTP ${post.status}`}`,
    );
    return post.status === 400 ? EXIT.invalid : EXIT.render;
  }

  let job: JobView = { state: "queued" };
  let last = "";
  for (;;) {
    const res = await fetch(`${base()}/api/production-jobs/${queued.jobId}`, {
      headers: headers(),
    });
    const body = (await res.json()) as { job?: JobView } & JobView;
    job = body.job ?? body;
    const running = job.steps?.find((s) => s.state === "running")?.key ?? "";
    const line = `${job.state} ${running} ${Math.floor(((job.progress ?? 0) * 100) / 5) * 5}%`;
    if (line !== last) {
      last = line;
      say(
        {
          event: "progress",
          state: job.state,
          stage: running,
          progress: job.progress ?? 0,
        },
        `  ${line.trim()}`,
      );
    }
    if (["succeeded", "failed", "canceled"].includes(job.state)) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const video = job.outputs?.find((o) => o.kind === "video");
  if (job.state !== "succeeded" || !video) {
    say(
      { event: "failed", error: job.error ?? job.state },
      `✗ Render ${job.state}: ${job.error ?? "no video was produced"}`,
    );
    return EXIT.render;
  }
  const artifact = (await (
    await fetch(
      `${base()}/api/production-jobs/${queued.jobId}/artifacts/${video.id}`,
      { headers: headers() },
    )
  ).json()) as { artifact?: { downloadUrl?: string } };
  const url = artifact.artifact?.downloadUrl;
  if (!url) {
    say(
      { event: "failed", error: "no download url" },
      "✗ The engine gave no download link",
    );
    return EXIT.render;
  }
  const mp4 = await fetch(`${base()}${url}`, { headers: headers() });
  const target = path.resolve(
    args.out ?? defaultOutputName(lint.storyboard.title),
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await mp4.arrayBuffer()));
  say({ event: "done", path: target }, undefined);
  if (!args.json) console.log(target);
  return EXIT.ok;
}

function examplesCommand(rest: string[]): number {
  const dir = path.join(root, "examples", "storyboards");
  const force = rest.includes("--force");
  let copied = 0;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const target = path.resolve(name);
    if (existsSync(target) && !force) continue;
    copyFileSync(path.join(dir, name), target);
    copied += 1;
    console.log(name);
  }
  console.error(`Copied ${copied} example storyboard(s) to ${process.cwd()}`);
  return EXIT.ok;
}

async function launchInstalledStudio(): Promise<number> {
  const { baseUrl } = await ensureEngine(
    (message) => console.error(message),
    "user",
  );
  console.log(baseUrl);
  if (process.env.REEL_STUDIO_NO_OPEN !== "1") {
    const platform = process.platform;
    const command =
      platform === "darwin"
        ? "open"
        : platform === "win32"
          ? "rundll32.exe"
          : "xdg-open";
    const args =
      platform === "win32"
        ? ["url.dll,FileProtocolHandler", baseUrl]
        : [baseUrl];
    await new Promise<void>((resolve) => {
      const browser = spawn(command, args, { stdio: "ignore" });
      browser.once("error", () => resolve());
      browser.once("spawn", () => {
        browser.unref();
        resolve();
      });
    });
  }
  return EXIT.ok;
}

export async function main(
  argv: string[],
  options: { installed?: boolean } = {},
): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "render":
        return await renderCommand(rest, options.installed);
      case "lint":
        return await lintCommand(rest);
      case "schema":
        console.log(
          readFileSync(
            path.join(root, "schemas", "storyboard.v1.json"),
            "utf8",
          ),
        );
        return EXIT.ok;
      case "examples":
        return examplesCommand(rest);
      case "doctor":
        return await new Promise<number>((resolve) => {
          const child = spawn(
            process.execPath,
            [
              ...(options.installed
                ? [path.join(root, "scripts", "doctor.mjs")]
                : ["--import", "tsx", path.join(root, "scripts", "doctor.ts")]),
              ...rest,
            ],
            { cwd: root, stdio: "inherit", env: process.env },
          );
          child.once("exit", (code) => resolve(code ?? 1));
          child.once("error", () => resolve(EXIT.missing));
        });
      case "mcp":
        // The MCP server runs as its own process on stdio (it finds or starts
        // the local engine itself); nothing here may print to stdout.
        return await new Promise<number>((resolve) => {
          const child = spawn(
            process.execPath,
            options.installed
              ? [path.join(root, "mcp", "src", "index.mjs")]
              : ["--import", "tsx", path.join(root, "mcp", "src", "index.ts")],
            { cwd: root, stdio: "inherit", env: process.env },
          );
          child.once("exit", (code) => resolve(code ?? 1));
          child.once("error", () => resolve(EXIT.missing));
        });
      case undefined:
        if (options.installed) return await launchInstalledStudio();
        console.log(HELP);
        return EXIT.ok;
      case "help":
      case "--help":
      case "-h":
        console.log(HELP);
        return EXIT.ok;
      default:
        console.error(`Unknown command "${command}"\n\n${HELP}`);
        return EXIT.usage;
    }
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`${e.message}\n\n${HELP}`);
      return EXIT.usage;
    }
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
      console.error(`✗ ${String((e as { message?: unknown }).message)}`);
      return EXIT.usage;
    }
    console.error(e instanceof Error ? e.message : String(e));
    return EXIT.render;
  }
}
