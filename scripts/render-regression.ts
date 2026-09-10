/** Real, credential-free renders for both engines. Outputs stay in .artifacts. */
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fixture from "../tests/fixtures/legacy-reel.json";
import type { ReelProps } from "../src/compositions/types";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition";
import { remotionWebpackOverride } from "../src/remotion/webpack-override";

async function main() {
const run = promisify(execFile);
const output = path.resolve(".artifacts/render-regression");
await mkdir(output, { recursive: true });
const engines = process.argv.slice(2);
const selected = engines.length ? engines : ["hyperframes", "remotion"];
if (selected.some((engine) => !["hyperframes", "remotion"].includes(engine))) {
  throw new Error("Expected hyperframes and/or remotion");
}
const props = fixture as ReelProps;
for (const engine of selected) {
  const mp4 = path.join(output, `${engine}.mp4`);
  if (engine === "hyperframes") {
    const project = path.join(output, "hyperframes");
    await mkdir(project, { recursive: true });
    await writeFile(path.join(project, "index.html"), buildHyperframesCompositionHtml(props));
    const result = await run(process.execPath, ["scripts/hyperframes-render-worker.mjs", project, mp4, "30", "draft"], { timeout: 300_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(result.stdout);
  } else {
    const inputProps: ReelProps = {
      ...props,
      scenes: props.scenes.map((scene) => ({ ...scene, templateId: "kinetic" })),
    };
    const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts"), webpackOverride: remotionWebpackOverride });
    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps });
    await renderMedia({ serveUrl, composition: { ...composition, durationInFrames: 90 }, inputProps, outputLocation: mp4, codec: "h264", concurrency: 2, logLevel: "error" });
    for (const frame of [0, 22, 44, 45, 67, 89]) {
      await renderStill({ serveUrl, composition, inputProps, frame, output: path.join(output, `remotion-${frame}.png`), logLevel: "error" });
    }
  }
  if ((await stat(mp4)).size < 10_000) throw new Error(`${engine}: empty render`);
  console.log(`${engine}: ${mp4}`);
}

}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
