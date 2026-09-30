import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/library/db";
import { brandOverridesSchema, parseJsonColumn } from "@/library/schemas";
import { sanitizeKey } from "@/library/storage/local-disk";
import { assertPathInsideRoot } from "@/server/url-safety";
import { ProviderError } from "@/providers/voice/types";
import {
  musicMapSchema,
  proposeMusicRhythm,
  type MusicMap,
  type MusicMapEdit,
} from "@/production/music-map";

const run = promisify(execFile);
async function sourceAudio(url: string, baseUrl: string) {
  const parsed = new URL(url, baseUrl);
  if (
    parsed.origin !== new URL(baseUrl).origin ||
    !/^\/(media|music)\//.test(parsed.pathname)
  )
    throw new ProviderError(
      "Import or upload this track locally before reviewing its beats.",
      400,
    );
  const media = parsed.pathname.startsWith("/media/");
  const root = path.resolve(media ? "media" : "public/music");
  const key = sanitizeKey(decodeURIComponent(parsed.pathname.slice(7)));
  const file = await fs.realpath(
    assertPathInsideRoot(root, path.join(root, key)),
  );
  assertPathInsideRoot(root, file);
  if ((await fs.stat(file)).size > 64 * 1024 * 1024)
    throw new ProviderError(
      "Use a music clip smaller than 64 MB for beat review.",
      400,
    );
  const bytes = await fs.readFile(file);
  return {
    bytes,
    extension: path.extname(file),
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function saveMap(
  scriptId: string,
  map: MusicMap,
  expected: MusicMap | undefined,
) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.script.findUnique({ where: { id: scriptId } });
    if (!row) throw new ProviderError("Script not found", 404);
    const overrides = parseJsonColumn(
      row.brandOverrides,
      brandOverridesSchema,
      {},
    );
    if (
      row.musicUrl !== map.sourceUrl ||
      JSON.stringify(overrides.musicMap) !== JSON.stringify(expected)
    )
      throw new ProviderError(
        "Music direction changed. Reload the current map before saving.",
        409,
      );
    await tx.script.update({
      where: { id: scriptId },
      data: { brandOverrides: JSON.stringify({ ...overrides, musicMap: map }) },
    });
    return map;
  });
}

export async function analyzeMusicMap(
  scriptId: string,
  baseUrl: string,
): Promise<MusicMap> {
  const row = await prisma.script.findUnique({ where: { id: scriptId } });
  if (!row) throw new ProviderError("Script not found", 404);
  if (!row.musicUrl)
    throw new ProviderError("Choose a music track first.", 400);
  const source = await sourceAudio(row.musicUrl, baseUrl);
  const overrides = parseJsonColumn(
    row.brandOverrides,
    brandOverridesSchema,
    {},
  );
  if (
    overrides.musicMap?.sourceUrl === row.musicUrl &&
    overrides.musicMap.sourceHash === source.hash
  )
    return overrides.musicMap;
  const directory = await fs.mkdtemp(path.join(tmpdir(), "reel-music-map-"));
  try {
    const file = path.join(directory, `source${source.extension}`);
    await fs.writeFile(file, source.bytes);
    let pcm: Buffer;
    try {
      const result = await run(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          file,
          "-t",
          "181",
          "-ar",
          "8000",
          "-ac",
          "1",
          "-f",
          "s16le",
          "pipe:1",
        ],
        { encoding: "buffer", timeout: 20_000, maxBuffer: 4 * 1024 * 1024 },
      );
      pcm = result.stdout;
    } catch {
      throw new ProviderError(
        "This track could not be decoded for beat review. Check that FFmpeg is available and the audio is valid.",
        400,
      );
    }
    const samples = new Float32Array(Math.floor(pcm.length / 2));
    for (let index = 0; index < samples.length; index++)
      samples[index] = pcm.readInt16LE(index * 2) / 32768;
    const durationSeconds = samples.length / 8000;
    if (!durationSeconds || durationSeconds > 180)
      throw new ProviderError(
        "Use a music clip of up to 180 seconds for beat review.",
        400,
      );
    const proposal = proposeMusicRhythm(samples, 8000);
    const map = musicMapSchema.parse({
      version: 1,
      sourceUrl: row.musicUrl,
      sourceHash: source.hash,
      durationSeconds,
      bpm: proposal?.bpm ?? 120,
      offsetSeconds: proposal?.offsetSeconds ?? 0,
      confidence: proposal?.confidence ?? 0,
      method: proposal ? "energy-onsets" : "manual",
      disabledBeats: [],
      dropSeconds: null,
    });
    return await saveMap(scriptId, map, overrides.musicMap);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

export async function editMusicMap(
  scriptId: string,
  input: MusicMapEdit,
  baseUrl: string,
) {
  const source = await sourceAudio(input.expected.sourceUrl, baseUrl);
  if (source.hash !== input.expected.sourceHash)
    throw new ProviderError(
      "The audio file changed. Analyze the current track again.",
      409,
    );
  const result = musicMapSchema.safeParse({
    ...input.expected,
    ...input.changes,
    method:
      (input.changes.bpm !== undefined &&
        input.changes.bpm !== input.expected.bpm) ||
      (input.changes.offsetSeconds !== undefined &&
        input.changes.offsetSeconds !== input.expected.offsetSeconds)
        ? "manual"
        : input.expected.method,
  });
  if (!result.success)
    throw new ProviderError(result.error.issues[0].message, 400);
  return saveMap(scriptId, result.data, input.expected);
}
