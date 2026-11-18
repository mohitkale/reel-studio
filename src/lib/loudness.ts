import { spawn } from "node:child_process";

/**
 * Loudness mastering for finished episodes (roadmap A1): measure integrated
 * loudness (EBU R128, in LUFS) and bring a WAV to a target with two passes of
 * FFmpeg's loudnorm, so the result lands within about one LU of the target.
 * Needs FFmpeg, like every export.
 */
const FFMPEG = () => process.env.FFMPEG_BIN?.trim() || "ffmpeg";

function run(
  args: string[],
  input?: Buffer,
): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG(), ["-hide_banner", "-nostats", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout: Buffer.concat(out), stderr: err })
        : reject(new Error(`ffmpeg failed (${code}): ${err.slice(-400)}`)),
    );
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

/** Integrated loudness of a WAV in LUFS, or null for silence. */
export async function measureLufs(wav: Buffer): Promise<number | null> {
  const { stderr } = await run(
    [
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-af",
      "ebur128=framelog=quiet",
      "-f",
      "null",
      "-",
    ].map((value) => value),
    wav,
  );
  const match = stderr.match(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g);
  if (!match) return null;
  const value = Number(match.at(-1)!.match(/-?\d+(?:\.\d+)?/)![0]);
  return Number.isFinite(value) && value > -70 ? value : null;
}

interface LoudnormStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/**
 * Bring a WAV to `targetLufs` (default -16, the usual podcast level) with a true
 * peak ceiling of -1.5 dB. Silence is returned unchanged. Output is 16-bit PCM at
 * the input's sample rate and channel count.
 */
export async function masterToLufs(
  wav: Buffer,
  options: { targetLufs?: number; sampleRate?: number; channels?: number } = {},
): Promise<Buffer> {
  const target = options.targetLufs ?? -16;
  if ((await measureLufs(wav)) === null) return wav;
  const filter = `loudnorm=I=${target}:TP=-1.5:LRA=11`;
  const first = await run(
    [
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-af",
      `${filter}:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    wav,
  );
  const json = first.stderr.slice(first.stderr.lastIndexOf("{"));
  let stats: LoudnormStats;
  try {
    stats = JSON.parse(
      json.slice(0, json.lastIndexOf("}") + 1),
    ) as LoudnormStats;
  } catch {
    throw new Error("Could not read the loudness measurement from FFmpeg");
  }
  const second = `${filter}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
  const rate = options.sampleRate;
  const result = await run(
    [
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-af",
      second,
      ...(rate ? ["-ar", String(rate)] : []),
      ...(options.channels ? ["-ac", String(options.channels)] : []),
      "-c:a",
      "pcm_s16le",
      "-f",
      "wav",
      "pipe:1",
    ],
    wav,
  );
  return result.stdout;
}
