import path from "node:path";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import type { PodcastAudiogramPlan } from "@/library/podcast-audiogram";
import type { RenderQuality } from "@/library/render-service";
import { buildAudiogramHtml } from "@/engines/hyperframes/build-audiogram";
import { HYPERFRAMES_RENDER_FONT_FILES } from "@/engines/hyperframes/render-fonts";
import { cancelChild } from "@/library/production-cancellation";

export async function writeAudiogramProject(
  directory: string,
  plan: PodcastAudiogramPlan,
) {
  const runtime = path.join(directory, "_runtime");
  await fs.mkdir(runtime, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(directory, "index.html"),
      buildAudiogramHtml(plan.props),
    ),
    fs.writeFile(path.join(directory, "audio.wav"), plan.wav),
    fs.copyFile(
      path.resolve("node_modules/gsap/dist/gsap.min.js"),
      path.join(runtime, "gsap.min.js"),
    ),
    fs.copyFile(
      path.resolve(
        "node_modules/@fontsource-variable/geist/files",
        HYPERFRAMES_RENDER_FONT_FILES.sans,
      ),
      path.join(runtime, "geist.woff2"),
    ),
  ]);
}

export async function renderHyperframesAudiogram(
  plan: PodcastAudiogramPlan,
  outputPath: string,
  quality: RenderQuality,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const directory = await fs.mkdtemp(path.join(tmpdir(), "reel-audiogram-"));
  try {
    await writeAudiogramProject(directory, plan);
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          path.resolve("scripts/hyperframes-render-worker.mjs"),
          directory,
          outputPath,
          String(plan.props.fps),
          quality,
        ],
        {
          detached: process.platform !== "win32",
          stdio: ["ignore", "ignore", "pipe"],
          env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
        },
      );
      const waitForCleanup = cancelChild(child, signal);
      let error = "";
      child.stderr.on("data", (chunk: Buffer) => {
        if (error.length < 65_536) error += chunk.toString();
      });
      child.once("error", reject);
      child.once("close", async (code) => {
        try {
          await waitForCleanup();
        } catch (error) {
          reject(error);
          return;
        }
        if (signal.aborted) reject(new Error("Production canceled"));
        else if (code !== 0)
          reject(new Error(`Audiogram export failed: ${error.slice(-2048)}`));
        else resolve();
      });
    });
  } catch (error) {
    await fs.rm(outputPath, { force: true });
    throw error;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
