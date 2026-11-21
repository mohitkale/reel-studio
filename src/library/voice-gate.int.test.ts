import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { verifyVoiceGate } from "../../scripts/verify-voice-gate";

const revision = "a".repeat(40);
const evidence = "https://example.com/release-evidence";
const filenames = [
  "voice.safetensors",
  "voice.json",
  "requirements.lock",
] as const;
const digest = (content: string) =>
  createHash("sha256").update(content).digest("hex");
const artifacts = filenames.slice(0, 2).map((filename) => ({
  path: String(filename),
  kind: filename.endsWith(".safetensors") ? "weights" : "data",
  sha256: digest(filename),
  revision,
  source: `https://example.com/resolve/${revision}/${filename}`,
}));

let directory: string;
let staged: string;
let manifestPath: string;
const fixture = () => ({
  model: "Synthetic checksum fixture",
  artifacts: artifacts.map((artifact) => ({ ...artifact })),
  terms: {
    code: evidence,
    weights: evidence,
    trainingData: [evidence],
    commercialUseAllowed: true,
    delivery: "optional-download",
  },
  runtime: {
    bindHost: "127.0.0.1",
    outboundNetwork: false,
    writesOutsideData: false,
    trustRemoteCode: false,
    runtimeDownloads: false,
    evidence,
  },
  audits: {
    app: evidence,
    sidecar: evidence,
    lockfile: { path: filenames[2], sha256: digest(filenames[2]) },
  },
  referenceAudio: { kind: "none" },
});

async function verify(input = fixture()) {
  await writeFile(manifestPath, JSON.stringify(input));
  return verifyVoiceGate(manifestPath);
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "reel-voice-gate-"));
  staged = path.join(directory, "staged");
  await mkdir(staged);
  manifestPath = path.join(staged, "manifest.json");
  await Promise.all(
    filenames.map((filename) =>
      writeFile(path.join(staged, filename), filename),
    ),
  );
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("verifies all declared files, including the sidecar lockfile", async () => {
  expect(await verify()).toEqual({
    model: "Synthetic checksum fixture",
    files: 3,
  });
});

it.each(filenames)(
  "rejects changed bytes in %s without modifying the file",
  async (filename) => {
    const file = path.join(staged, filename);
    await writeFile(file, "changed");
    await expect(verify()).rejects.toThrow(`SHA-256 mismatch for ${filename}`);
    expect(await readFile(file, "utf8")).toBe("changed");
  },
);

it("rejects pickle checkpoints and unpinned downloads", async () => {
  const manifest = fixture();
  manifest.artifacts[0] = {
    ...manifest.artifacts[0],
    path: "voice.pth",
    source: "https://example.com/resolve/main/voice.pth",
  };
  await expect(verify(manifest)).rejects.toThrow(
    /\.onnx.*\.safetensors[\s\S]*immutable revision/,
  );
});

it("rejects an exposed runtime or reference audio with missing consent evidence", async () => {
  const manifest = fixture();
  manifest.runtime = {
    ...manifest.runtime,
    bindHost: "0.0.0.0",
    outboundNetwork: true,
    trustRemoteCode: true,
  };
  manifest.referenceAudio = { kind: "consented" };
  await expect(verify(manifest)).rejects.toThrow(
    /bindHost[\s\S]*outboundNetwork[\s\S]*trustRemoteCode[\s\S]*referenceAudio/,
  );
});

it("rejects a staged directory link that would read outside the manifest root", async () => {
  const outside = path.join(directory, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, filenames[0]), filenames[0]);
  await symlink(outside, path.join(staged, "linked"), "junction");
  const manifest = fixture();
  manifest.artifacts[0].path = `linked/${filenames[0]}`;
  await expect(verify(manifest)).rejects.toThrow("Path escapes storage root");
});
