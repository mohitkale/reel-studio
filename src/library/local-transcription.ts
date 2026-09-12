import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { parseCaptions, type CaptionCue } from "@/lib/captions";
import { ProviderError } from "@/providers/voice/types";

export interface LocalTranscriptionStatus {
  available: boolean;
  binary: string | null;
  model: string | null;
  reason: string | null;
}

async function isReadable(filename: string): Promise<boolean> {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(filename: string): Promise<boolean> {
  try {
    await access(filename, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(command: string): Promise<string | null> {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

export async function getLocalTranscriptionStatus(): Promise<LocalTranscriptionStatus> {
  const configuredBinary = process.env.WHISPER_CPP_BIN?.trim();
  const commands =
    process.platform === "win32"
      ? ["whisper-cli.exe", "whisper.exe"]
      : ["whisper-cli", "whisper"];
  let binary = configuredBinary ? path.resolve(configuredBinary) : null;
  for (const command of commands) {
    if (binary) break;
    binary = await findOnPath(command);
  }
  const configuredModel = process.env.WHISPER_CPP_MODEL?.trim();
  const model = configuredModel ? path.resolve(configuredModel) : null;
  if (!binary || !(await isExecutable(binary))) {
    return {
      available: false,
      binary: null,
      model,
      reason: "Install whisper.cpp or set WHISPER_CPP_BIN to its CLI binary.",
    };
  }
  if (!model || !(await isReadable(model))) {
    return {
      available: false,
      binary,
      model: null,
      reason: "Set WHISPER_CPP_MODEL to an installed whisper.cpp model file.",
    };
  }
  return { available: true, binary, model, reason: null };
}

function runWhisper(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < 8_000) stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(stderr.trim() || `whisper.cpp exited with code ${code}`),
        );
    });
  });
}

/** Transcribe a WAV buffer into editable frame-based cues using a local model. */
export async function transcribeWithWhisperCpp(input: {
  audio: Buffer;
  fps: number;
  language?: string;
}): Promise<CaptionCue[]> {
  const status = await getLocalTranscriptionStatus();
  if (!status.available || !status.binary || !status.model) {
    throw new ProviderError(
      status.reason ?? "Local transcription is unavailable",
      503,
    );
  }
  const directory = await mkdtemp(path.join(tmpdir(), "reel-whisper-"));
  const audioPath = path.join(directory, "audio.wav");
  const outputBase = path.join(directory, "captions");
  try {
    await writeFile(audioPath, input.audio);
    const args = [
      "-m",
      status.model,
      "-f",
      audioPath,
      "-osrt",
      "-of",
      outputBase,
    ];
    if (input.language?.trim()) args.push("-l", input.language.trim());
    await runWhisper(status.binary, args);
    const source = await readFile(`${outputBase}.srt`, "utf8");
    const cues = parseCaptions(source, input.fps, "srt");
    if (!cues.length) {
      throw new Error("whisper.cpp completed without producing caption cues");
    }
    return cues;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      error instanceof Error
        ? `Local transcription failed: ${error.message}`
        : "Local transcription failed",
      502,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
