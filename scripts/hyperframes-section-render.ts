import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { planRenderSections } from "../src/production/render-sections";
import { renderCachedSection } from "../src/library/render-section-cache";
import {
  hyperframesSectionCacheKey,
  stableHyperframesVideoMetadata,
} from "../src/library/hyperframes-section-cache-key";
import { withProductionSignal } from "../src/library/production-cancellation";

/** Native closed-GOP chunks preserve global frame seeks and mix audio once. */
export async function renderHyperframesSections(
  input: {
    projectDir: string;
    outputPath: string;
    fps: number;
    quality: string;
    width: number;
    height: number;
    signal: AbortSignal;
  },
  producer: Pick<
    typeof import("@hyperframes/producer"),
    "planV2" | "renderChunkV2" | "assembleV2" | "readPlanV2Manifest"
  >,
) {
  const { planV2, renderChunkV2, assembleV2, readPlanV2Manifest } = producer;
  const config = z
    .object({
      fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
      width: z.number().int().positive().max(7680),
      height: z.number().int().positive().max(7680),
      quality: z.enum(["draft", "standard", "high"]),
    })
    .parse(input);
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "reel-hf-sections-"),
  );
  return withProductionSignal(input.signal, async () => {
    try {
      const planDir = path.join(directory, "plan");
      const plan = await planV2(
        input.projectDir,
        {
          ...config,
          format: "mp4",
          codec: "h264",
          chunkSize: config.fps * 30,
          maxParallelChunks: 20,
          hdrMode: "force-sdr",
          rejectOnSystemFonts: true,
          failClosedFontFetch: true,
          strictness: "best-effort",
          abortSignal: input.signal,
        },
        planDir,
      );
      const sections = planRenderSections(plan.totalFrames, config.fps);
      if (sections.length !== plan.chunkCount)
        throw new Error(
          "HyperFrames section coverage differs from the frozen plan.",
        );
      const wholeManifest = readPlanV2Manifest(planDir);
      const visualRoot = path.join(`${input.projectDir}-sections`, "visuals");
      let scoped = false;
      try {
        const record = z
          .object({
            version: z.literal(1),
            totalFrames: z.literal(plan.totalFrames),
            fps: z.literal(config.fps),
            count: z.literal(sections.length),
          })
          .strict()
          .parse(
            JSON.parse(
              await fs.readFile(path.join(visualRoot, "manifest.json"), "utf8"),
            ),
          );
        scoped = record.count === sections.length;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      console.log("HF_PROGRESS 0.10");
      const chunks: string[] = [];
      for (const section of sections) {
        input.signal.throwIfAborted();
        let renderPlanDir = planDir;
        let manifest = wholeManifest;
        if (scoped) {
          renderPlanDir = path.join(directory, `visual-plan-${section.index}`);
          const visualPlan = await planV2(
            path.join(visualRoot, String(section.index)),
            {
              ...config,
              format: "mp4",
              codec: "h264",
              chunkSize: config.fps * 30,
              maxParallelChunks: 20,
              hdrMode: "force-sdr",
              rejectOnSystemFonts: true,
              failClosedFontFetch: true,
              strictness: "best-effort",
              abortSignal: input.signal,
            },
            renderPlanDir,
          );
          if (
            visualPlan.totalFrames !== plan.totalFrames ||
            visualPlan.chunkCount !== plan.chunkCount ||
            visualPlan.width !== plan.width ||
            visualPlan.height !== plan.height ||
            visualPlan.fps !== plan.fps
          )
            throw new Error(
              "Scoped HyperFrames inputs changed global coverage or dimensions.",
            );
          manifest = readPlanV2Manifest(renderPlanDir);
          const encoder = (value: typeof manifest) =>
            value.artifacts.find(
              (artifact) => artifact.path === "meta/encoder.json",
            )?.sha256;
          if (
            !encoder(manifest) ||
            encoder(manifest) !== encoder(wholeManifest)
          )
            throw new Error(
              "Scoped HyperFrames encoder differs from the complete plan.",
            );
        }
        const key = hyperframesSectionCacheKey(
          manifest,
          section.index,
          await stableHyperframesVideoMetadata(renderPlanDir, manifest),
        );
        const result = await renderCachedSection({
          key,
          section,
          temporaryDirectory: directory,
          render: async (filename) => {
            const chunk = await renderChunkV2(
              renderPlanDir,
              section.index,
              filename,
            );
            if (
              chunk.framesEncoded !==
              section.endFrame - section.startFrame + 1
            )
              throw new Error("HyperFrames returned an incomplete section.");
          },
        });
        chunks.push(result.filename);
        console.log(
          `HF_SECTION ${JSON.stringify({ index: section.index, frames: section.endFrame - section.startFrame + 1, reused: result.reused, scoped })}`,
        );
        console.log(
          `HF_PROGRESS ${(0.1 + (0.8 * (section.index + 1)) / sections.length).toFixed(4)}`,
        );
      }
      input.signal.throwIfAborted();
      await assembleV2(planDir, chunks, input.outputPath, {
        abortSignal: input.signal,
      });
      input.signal.throwIfAborted();
      console.log("HF_PROGRESS 0.95");
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
}
