import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type {
  ClaimedProductionJob,
  ProductionStepKey,
  VideoProductionJobInput,
} from "@/production/jobs";
import { videoProductionJobInputSchema } from "@/production/jobs";
import { runRenderNow } from "@/library/render-service";
import { prisma } from "@/library/db";
import {
  addProductionJobOutput,
  upsertProductionJobStep,
} from "@/library/repositories/production-jobs";

type Context = { signal: AbortSignal; heartbeat: () => Promise<boolean> };
type Dependencies = {
  render: (input: VideoProductionJobInput) => Promise<void>;
  artifact: (
    renderId: string,
  ) => Promise<{ path: string; expectsAudio: boolean }>;
  verify: (
    path: string,
    expectsAudio: boolean,
  ) => Promise<Record<string, unknown>>;
  step: typeof upsertProductionJobStep;
  output: typeof addProductionJobOutput;
};

export async function verifyProductionMp4(
  filePath: string,
  expectsAudio: boolean,
) {
  const stats = await fs.stat(filePath);
  if (stats.size < 10_000) throw new Error("Rendered MP4 is empty");
  const { stdout } = await promisify(execFile)("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const probe = JSON.parse(stdout) as {
    streams?: Array<Record<string, unknown>>;
    format?: { duration?: string };
  };
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  if (
    !video ||
    Number(video.width) < 1 ||
    Number(video.height) < 1 ||
    Number(probe.format?.duration) <= 0
  )
    throw new Error("Rendered MP4 is not decodable");
  if (expectsAudio && !audio)
    throw new Error("Rendered MP4 is missing expected audio");
  const checksum = createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
  return {
    bytes: stats.size,
    width: video.width,
    height: video.height,
    duration: Number(probe.format?.duration),
    hasAudio: Boolean(audio),
    checksum: `sha256:${checksum}`,
  };
}

const defaults: Dependencies = {
  render: (input) => runRenderNow(input),
  artifact: async (renderId) => {
    const render = await prisma.render.findUniqueOrThrow({
      where: { id: renderId },
      include: { script: { include: { takes: true } } },
    });
    if (!render.outputPath)
      throw new Error(`Render ${renderId} has no output path`);
    return {
      path: path.join(process.cwd(), "media", render.outputPath),
      expectsAudio: Boolean(render.voiceTakeId),
    };
  },
  verify: verifyProductionMp4,
  step: upsertProductionJobStep,
  output: addProductionJobOutput,
};

export async function executeVideoProductionJob(
  job: ClaimedProductionJob,
  context: Context,
  dependencies: Dependencies = defaults,
): Promise<void> {
  const input = videoProductionJobInputSchema.parse(job.inputSnapshot);
  const stages: ProductionStepKey[] = [
    "validate",
    "plan",
    "resolve_media",
    "synthesize_audio",
    "time_content",
    "prepare_composition",
  ];
  for (const key of stages) {
    if (context.signal.aborted || !(await context.heartbeat()))
      throw new Error("Production canceled");
    await dependencies.step(job.id, key, {
      state: "succeeded",
      progress: 1,
      detail: { reused: key === "synthesize_audio" },
    });
  }
  await dependencies.step(job.id, "render_export", {
    state: "running",
    progress: 0,
  });
  await dependencies.render(input);
  await dependencies.step(job.id, "render_export", {
    state: "succeeded",
    progress: 1,
  });
  const artifact = await dependencies.artifact(input.renderId);
  await dependencies.step(job.id, "verify_artifacts", {
    state: "running",
    progress: 0,
  });
  const metadata = await dependencies.verify(
    artifact.path,
    artifact.expectsAudio,
  );
  await dependencies.output(job.id, {
    kind: "video",
    format: "mp4",
    path: artifact.path,
    checksum:
      typeof metadata.checksum === "string" ? metadata.checksum : undefined,
    metadata,
  });
  await dependencies.step(job.id, "verify_artifacts", {
    state: "succeeded",
    progress: 1,
    detail: metadata,
  });
}
