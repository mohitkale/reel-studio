// @vitest-environment node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ChecksumError,
  downloadVerified,
  ffmpegBuildFor,
  ffmpegInstallHint,
  installedFfmpegBin,
  installFfmpeg,
} from "./tool-install";

let dir: string;
let server: Server;
let base: string;
const good = Buffer.from("pretend this is a zip archive");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "reel-tools-"));
  server = createServer((req, res) => {
    if (req.url === "/good.zip") res.end(good);
    else if (req.url === "/tampered.zip")
      res.end(Buffer.from("something else entirely"));
    else res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("downloadVerified", () => {
  it("keeps a file whose checksum matches", async () => {
    const dest = path.join(dir, "ok.zip");
    await downloadVerified({
      url: `${base}/good.zip`,
      sha256: sha(good),
      dest,
    });
    expect(readFileSync(dest).equals(good)).toBe(true);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it("rejects and deletes a tampered file", async () => {
    const dest = path.join(dir, "bad.zip");
    await expect(
      downloadVerified({
        url: `${base}/tampered.zip`,
        sha256: sha(good),
        dest,
      }),
    ).rejects.toBeInstanceOf(ChecksumError);
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it("reports a failed request", async () => {
    await expect(
      downloadVerified({
        url: `${base}/nope.zip`,
        sha256: sha(good),
        dest: path.join(dir, "x"),
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe("installFfmpeg", () => {
  it("downloads, verifies, unpacks and finds ffmpeg and ffprobe", async () => {
    const exe = process.platform === "win32" ? ".exe" : "";
    const bin = await installFfmpeg({
      build: {
        version: "t",
        url: `${base}/good.zip`,
        sha256: sha(good),
        archive: "zip",
        source: "test",
        license: "test",
        approxBytes: 1,
      },
      home: dir,
      extract: (_archive, into) => {
        const b = path.join(into, "ffmpeg-t", "bin");
        mkdirSync(b, { recursive: true });
        writeFileSync(path.join(b, `ffmpeg${exe}`), "");
        writeFileSync(path.join(b, `ffprobe${exe}`), "");
      },
    });
    expect(bin).toBe(path.join(dir, "tools", "ffmpeg", "ffmpeg-t", "bin"));
    expect(installedFfmpegBin(dir)).toBe(bin);
    expect(existsSync(path.join(dir, "tools", "ffmpeg-t.zip"))).toBe(false);
  });

  it("installs nothing when the checksum is wrong", async () => {
    await expect(
      installFfmpeg({
        build: {
          version: "t",
          url: `${base}/tampered.zip`,
          sha256: sha(good),
          archive: "zip",
          source: "t",
          license: "t",
          approxBytes: 1,
        },
        home: dir,
        extract: () => {
          throw new Error("must not unpack");
        },
      }),
    ).rejects.toBeInstanceOf(ChecksumError);
    expect(installedFfmpegBin(dir)).toBeNull();
  });
});

describe("pinned builds", () => {
  it("pins Windows x64 with a checksum and gives hints elsewhere", () => {
    expect(ffmpegBuildFor("win32", "x64")?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(ffmpegBuildFor("darwin", "arm64")).toBeNull();
    expect(ffmpegInstallHint("darwin")).toContain("brew install ffmpeg");
    expect(ffmpegInstallHint("linux")).toContain("apt");
  });
});
