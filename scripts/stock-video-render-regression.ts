/** Runs the local stock-video regression through both engines and all ratios. */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ORIENTATIONS } from "../src/lib/orientation";

async function runOrientation(orientation: (typeof ORIENTATIONS)[number]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/render-regression.ts",
        "--stock-video",
        `--orientation=${orientation}`,
      ],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Stock-video ${orientation} render failed (${signal ?? code})`,
          ),
        );
    });
  });
}

async function main() {
  for (const orientation of ORIENTATIONS) {
    await runOrientation(orientation);
  }
  const reportDirectory = path.resolve(".artifacts/stock-video-render");
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, "report.json"),
    `${JSON.stringify(
      {
        engines: ["hyperframes", "remotion"],
        orientations: ORIENTATIONS,
        fixture: "generated-local-video-with-audio",
        assertions: [
          "h264 output",
          "expected dimensions and duration",
          "visible foreground",
          "muted stock audio absent from output",
        ],
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
