/**
 * Fetching missing tools with consent (roadmap M8). A pinned, checksum-verified
 * build is downloaded from its upstream builder into the data directory; a file
 * whose hash does not match is deleted and rejected. Binaries are never part of
 * the npm package or the repository. System tools are used when they exist.
 */
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface FfmpegBuild {
  version: string;
  url: string;
  sha256: string;
  archive: "zip";
  /** Where it comes from and under what terms (also in docs/LICENSING.md). */
  source: string;
  license: string;
  approxBytes: number;
}

/**
 * Pinned FFmpeg builds by `platform-arch`. Only builds whose checksum has been
 * verified are listed; other platforms get an install hint instead.
 */
export const FFMPEG_BUILDS: Readonly<Record<string, FfmpegBuild>> = {
  "win32-x64": {
    version: "9.0.2",
    url: "https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-essentials_build.zip",
    sha256: "60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba",
    archive: "zip",
    source: "Gyan FFmpeg builds (linked from ffmpeg.org/download.html)",
    license: "GPL-3.0-or-later (a separate program, fetched from its builder)",
    approxBytes: 95_000_000,
  },
};

export function ffmpegBuildFor(
  platform: string,
  arch: string,
): FfmpegBuild | null {
  return FFMPEG_BUILDS[`${platform}-${arch}`] ?? null;
}

/** What to tell the user when there is no pinned build for their platform. */
export function ffmpegInstallHint(platform: string): string {
  if (platform === "darwin") return "Run: brew install ffmpeg";
  if (platform === "linux")
    return "Run: sudo apt install ffmpeg (or your distribution's package)";
  return "Install FFmpeg from https://ffmpeg.org/download.html and make sure ffmpeg and ffprobe are on PATH";
}

export class ChecksumError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `Checksum mismatch: expected ${expected} but the download hashed to ${actual}. The file was deleted.`,
    );
    this.name = "ChecksumError";
  }
}

/** Download to `dest`, verifying the SHA-256; a tampered file is removed. */
export async function downloadVerified(input: {
  url: string;
  sha256: string;
  dest: string;
  fetchImpl?: typeof fetch;
  onProgress?: (bytesDone: number, bytesTotal: number) => void;
}): Promise<void> {
  const res = await (input.fetchImpl ?? fetch)(input.url);
  if (!res.ok || !res.body)
    throw new Error(`Download failed: HTTP ${res.status} for ${input.url}`);
  mkdirSync(path.dirname(input.dest), { recursive: true });
  const part = `${input.dest}.part`;
  const total = Number(res.headers.get("content-length") ?? 0);
  const hash = createHash("sha256");
  let done = 0;
  const source = Readable.fromWeb(res.body as never);
  source.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    done += chunk.length;
    input.onProgress?.(done, total);
  });
  try {
    await pipeline(source, createWriteStream(part));
  } catch (error) {
    rmSync(part, { force: true });
    throw error;
  }
  const actual = hash.digest("hex");
  if (actual !== input.sha256.toLowerCase()) {
    rmSync(part, { force: true });
    throw new ChecksumError(input.sha256.toLowerCase(), actual);
  }
  renameSync(part, input.dest);
}

export const toolsDir = (home: string) => path.join(home, "tools");

/** Unpack a zip with the system `tar` (bsdtar reads zips on Windows, macOS and Linux). */
export function extractArchive(archive: string, into: string): void {
  mkdirSync(into, { recursive: true });
  const result = spawnSync("tar", ["-xf", archive, "-C", into], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(
      `Could not unpack ${path.basename(archive)}: ${result.stderr}`,
    );
}

/** Directory holding an installed ffmpeg and ffprobe, or null. */
export function installedFfmpegBin(home: string): string | null {
  const root = path.join(toolsDir(home), "ffmpeg");
  const exe = process.platform === "win32" ? ".exe" : "";
  const walk = (dir: string): string | null => {
    if (!existsSync(dir)) return null;
    // Look for a bin directory containing both programs.
    const candidate = path.join(dir, "bin");
    if (
      existsSync(path.join(candidate, `ffmpeg${exe}`)) &&
      existsSync(path.join(candidate, `ffprobe${exe}`))
    )
      return candidate;
    return null;
  };
  if (!existsSync(root)) return null;
  const direct = walk(root);
  if (direct) return direct;
  // The archive unpacks into one versioned folder.
  for (const entry of readdirSync(root)) {
    const found = walk(path.join(root, entry));
    if (found) return found;
  }
  return null;
}

/** Download, verify and unpack a pinned FFmpeg into `<home>/tools/ffmpeg`. */
export async function installFfmpeg(input: {
  build: FfmpegBuild;
  home: string;
  fetchImpl?: typeof fetch;
  onProgress?: (bytesDone: number, bytesTotal: number) => void;
  extract?: (archive: string, into: string) => void;
}): Promise<string> {
  const dir = path.join(toolsDir(input.home), "ffmpeg");
  const archive = path.join(
    toolsDir(input.home),
    `ffmpeg-${input.build.version}.zip`,
  );
  await downloadVerified({
    url: input.build.url,
    sha256: input.build.sha256,
    dest: archive,
    fetchImpl: input.fetchImpl,
    onProgress: input.onProgress,
  });
  (input.extract ?? extractArchive)(archive, dir);
  rmSync(archive, { force: true });
  const bin = installedFfmpegBin(input.home);
  if (!bin) throw new Error("The archive did not contain ffmpeg and ffprobe");
  return bin;
}
