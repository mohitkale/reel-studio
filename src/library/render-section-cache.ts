import path from "node:path";
import { promises as fs, createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  renderSectionSchema,
  type RenderSection,
} from "@/production/render-sections";
import {
  assertProductionActive,
  productionSignal,
} from "@/library/production-cancellation";

const execute = promisify(execFile);
const recordSchema = z
  .object({
    version: z.literal(1),
    key: z.string().regex(/^[a-f0-9]{64}$/),
    section: renderSectionSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().positive(),
  })
  .strict();
export async function hashRenderFile(filename: string) {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(filename)) digest.update(bytes);
  return digest.digest("hex");
}
export async function hashRenderDirectory(directory: string) {
  const digest = createHash("sha256");
  async function visit(relative: string) {
    for (const entry of (
      await fs.readdir(path.join(directory, relative), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile())
        digest.update(
          JSON.stringify([
            name,
            await hashRenderFile(path.join(directory, name)),
          ]),
        );
      else
        throw new Error("Render inputs must be regular files or directories.");
    }
  }
  await visit("");
  return digest.digest("hex");
}
export const renderCacheKey = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Retain recent retries; trim inactive generated caches toward a 1 GiB budget. */
export async function pruneRenderSectionCache(
  root: string,
  protectedKey: string,
) {
  const now = Date.now();
  const folders = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const directory = path.join(root, entry.name);
    try {
      const details = await fs.stat(directory);
      const files = await fs.readdir(directory, { withFileTypes: true });
      let bytes = 0;
      for (const file of files)
        if (file.isFile())
          bytes += (await fs.stat(path.join(directory, file.name))).size;
      folders.push({
        directory,
        modified: details.mtimeMs,
        bytes,
        protected: entry.name === protectedKey,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  let bytes = folders.reduce((sum, folder) => sum + folder.bytes, 0);
  for (const folder of folders.sort((a, b) => a.modified - b.modified)) {
    if (
      folder.protected ||
      now - folder.modified < 24 * 60 * 60 * 1000 ||
      (bytes <= 1024 ** 3 && now - folder.modified < 7 * 24 * 60 * 60 * 1000)
    )
      continue;
    try {
      if ((await fs.stat(folder.directory)).mtimeMs !== folder.modified)
        continue;
      await fs.rm(folder.directory, { recursive: true, force: true });
      bytes -= folder.bytes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function verifySilentSection(filename: string, frames: number) {
  const { stdout } = await execute(
    "ffprobe",
    [
      "-v",
      "error",
      "-count_packets",
      "-show_entries",
      "stream=codec_type,nb_read_packets",
      "-of",
      "json",
      filename,
    ],
    {
      signal: productionSignal(),
      timeout: 30_000,
      maxBuffer: 16_384,
    },
  );
  const probe = z
    .object({
      streams: z.array(
        z.object({
          codec_type: z.string(),
          nb_read_packets: z.coerce.number().int().optional(),
        }),
      ),
    })
    .parse(JSON.parse(stdout));
  const video = probe.streams.filter((stream) => stream.codec_type === "video");
  if (
    video.length !== 1 ||
    video[0].nb_read_packets !== frames ||
    probe.streams.some((stream) => stream.codec_type === "audio")
  )
    throw new Error(
      "A rendered section has incorrect frame coverage or contains audio.",
    );
}

/** Only checksum-verified, fully committed files are eligible for retry reuse. */
export async function renderCachedSection(args: {
  key: string;
  section: RenderSection;
  render: (temporary: string) => Promise<void>;
  root?: string;
  /** Same filesystem as the cache; isolated workers keep native scratch here. */
  temporaryDirectory?: string;
}): Promise<{ filename: string; reused: boolean }> {
  if (!/^[a-f0-9]{64}$/.test(args.key))
    throw new Error("Invalid render cache key");
  renderSectionSchema.parse(args.section);
  assertProductionActive();
  const directory = path.join(
    args.root ?? path.join(process.cwd(), "media", "render-cache"),
    args.key,
  );
  await fs.mkdir(directory, { recursive: true });
  await fs.utimes(directory, new Date(), new Date());
  if (args.section.index === 0 && !args.root)
    await pruneRenderSectionCache(path.dirname(directory), args.key);
  const filename = path.join(directory, `section-${args.section.index}.mp4`);
  const sidecar = `${filename}.json`;
  try {
    const size = await fs.stat(sidecar);
    if (size.size > 4096) throw new Error("Oversized render checkpoint");
    const record = recordSchema.parse(
      JSON.parse(await fs.readFile(sidecar, "utf8")),
    );
    if (
      record.key === args.key &&
      JSON.stringify(record.section) === JSON.stringify(args.section) &&
      (await fs.stat(filename)).size === record.size &&
      (await hashRenderFile(filename)) === record.sha256
    ) {
      assertProductionActive();
      return { filename, reused: true };
    }
  } catch {
    assertProductionActive();
  }
  const temporaryDirectory = args.temporaryDirectory ?? directory;
  await fs.mkdir(temporaryDirectory, { recursive: true });
  const temporary = path.join(
    temporaryDirectory,
    `section-${args.section.index}.${randomUUID()}.partial.mp4`,
  );
  const temporaryRecord = `${temporary}.json.tmp`;
  try {
    await args.render(temporary);
    assertProductionActive();
    await verifySilentSection(
      temporary,
      args.section.endFrame - args.section.startFrame + 1,
    );
    const record = recordSchema.parse({
      version: 1,
      key: args.key,
      section: args.section,
      sha256: await hashRenderFile(temporary),
      size: (await fs.stat(temporary)).size,
    });
    await fs.writeFile(temporaryRecord, JSON.stringify(record));
    assertProductionActive();
    await fs.rename(temporary, filename);
    await fs.rename(temporaryRecord, sidecar); // commit marker last
    return { filename, reused: false };
  } finally {
    await Promise.all([
      fs.rm(temporary, { force: true }),
      fs.rm(temporaryRecord, { force: true }),
    ]);
  }
}

/** Stitch silent frames and mux one continuous PCM mix. No per-section AAC seams. */
export async function assembleRenderSections(
  paths: readonly string[],
  audioPath: string | undefined,
  outputPath: string,
  totalFrames: number,
  fps: number,
) {
  assertProductionActive();
  const list = `${outputPath}.${randomUUID()}.concat.txt`;
  const temporary = `${outputPath}.${randomUUID()}.assembled.mp4`;
  try {
    // Paths are generated internally. FFmpeg concat syntax still needs escaping.
    await fs.writeFile(
      list,
      paths
        .map((filename) => `file '${filename.replaceAll("'", "'\\''")}'`)
        .join("\n"),
    );
    await execute(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        ...(audioPath
          ? [
              "-i",
              audioPath,
              "-map",
              "0:v:0",
              "-map",
              "1:a:0",
              "-af",
              "apad",
              "-c:a",
              "aac",
              "-b:a",
              "192k",
              "-ar",
              "48000",
            ]
          : ["-map", "0:v:0", "-an"]),
        "-c:v",
        "copy",
        "-t",
        String(totalFrames / fps),
        "-movflags",
        "+faststart",
        temporary,
      ],
      {
        signal: productionSignal(),
        timeout: 120_000,
        maxBuffer: 1_048_576,
      },
    );
    assertProductionActive();
    await fs.rename(temporary, outputPath);
  } finally {
    await Promise.all([
      fs.rm(list, { force: true }),
      fs.rm(temporary, { force: true }),
    ]);
  }
}
