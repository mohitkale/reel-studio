/**
 * `npm run doctor [-- --fix [--yes]]`: report what the studio needs (Node,
 * FFmpeg, FFprobe, a browser, disk space, the voice model, optional Whisper)
 * and, with --fix, fetch what is missing after one question per download
 * (roadmap M8). System tools are used when present. Nothing downloads without
 * consent: --yes (or REEL_STUDIO_AUTO_INSTALL=1) answers the question for you.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

import puppeteer from "puppeteer";

import { prisma } from "../src/library/db";
import { collectStudioDiagnostics } from "../src/library/studio-diagnostics";
import {
  ffmpegBuildFor,
  ffmpegInstallHint,
  installFfmpeg,
} from "../src/library/tool-install";
import {
  downloadVoiceModel,
  getVoiceModelStatus,
  KOKORO_APPROX_BYTES,
} from "../src/library/voice-model";
import { engineHome } from "../src/server/local-engine";

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const assumeYes =
  args.includes("--yes") || process.env.REEL_STUDIO_AUTO_INSTALL === "1";

async function ask(question: string): Promise<boolean> {
  if (assumeYes) return true;
  if (!process.stdin.isTTY) {
    console.log(`  ${question} (not asked: no terminal; re-run with --yes)`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`  ${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function browserPath(): Promise<string | null> {
  const configured = process.env.REEL_VERIFY_CHROME;
  if (configured && existsSync(configured)) return configured;
  try {
    const path = await puppeteer.executablePath();
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

async function main() {
  const report = await collectStudioDiagnostics();
  console.log(`Reel Studio diagnostics · ${report.platform}`);
  for (const check of report.checks) {
    const marker =
      check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×";
    console.log(`${marker} ${check.label}: ${check.detail}`);
    if (check.fix) console.log(`  ${check.fix}`);
  }
  const browser = await browserPath();
  console.log(
    browser
      ? `✓ Browser: ${browser}`
      : "× Browser: no Chrome for rendering was found\n  Run: npm run doctor -- --fix (downloads Chrome for Testing, about 150 MB)",
  );
  const voice = await getVoiceModelStatus();
  console.log(
    voice.cached
      ? `✓ Voice model: ${voice.location}`
      : `! Voice model: not downloaded (videos are silent with captions)\n  Run: npm run voice:download (about 90 MB)`,
  );
  const failed = report.checks.filter((c) => c.status === "fail");
  console.log(
    `\n${report.summary.passed} passed · ${report.summary.warnings} warnings · ${report.summary.failed + (browser ? 0 : 1)} failed`,
  );

  if (fix) {
    console.log(
      "\nFixing what is missing (system tools are used when present):",
    );
    const needsFfmpeg = failed.some((c) =>
      /encoder|verification/i.test(c.label),
    );
    if (needsFfmpeg) {
      const build = ffmpegBuildFor(process.platform, process.arch);
      if (!build)
        console.log(
          `  FFmpeg: no pinned download for this platform. ${ffmpegInstallHint(process.platform)}`,
        );
      else if (
        await ask(
          `Download FFmpeg ${build.version} (about ${Math.round(build.approxBytes / 1e6)} MB) from ${build.source} into ${engineHome()}/tools? Licence: ${build.license}.`,
        )
      ) {
        const bin = await installFfmpeg({ build, home: engineHome() });
        console.log(
          `  ✓ FFmpeg installed: ${bin}. The studio uses it automatically.`,
        );
      }
    }
    if (
      !browser &&
      (await ask(
        "Download Chrome for Testing (about 150 MB) with Puppeteer's installer?",
      ))
    ) {
      const result = spawnSync(
        "npx",
        ["puppeteer", "browsers", "install", "chrome"],
        { stdio: "inherit", shell: process.platform === "win32" },
      );
      console.log(
        result.status === 0
          ? "  ✓ Chrome installed"
          : "  × Chrome install failed",
      );
    }
    if (
      !voice.cached &&
      (await ask(
        `Download the voice model (about ${Math.round(KOKORO_APPROX_BYTES / 1e6)} MB) to ${voice.location}?`,
      ))
    ) {
      await downloadVoiceModel({});
      console.log("  ✓ Voice model ready");
    }
  } else if (failed.length > 0 || !browser) {
    console.log(
      '\nRun "npm run doctor -- --fix" to fetch what is missing (it asks first).',
    );
  }
  if (!report.ready || !browser) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
