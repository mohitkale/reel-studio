/**
 * Minimal WAV (RIFF/PCM) utilities shared by the voice pipeline.
 *
 * The provider layer normalizes every vendor's audio to a 16-bit PCM WAV at
 * 44100 Hz. These helpers parse that WAV to measure exact duration (so caption
 * timing can be derived) and build WAVs from raw PCM or silence.
 */

export const TARGET_SAMPLE_RATE = 44100;
export const TARGET_BITS_PER_SAMPLE = 16;
export const TARGET_CHANNELS = 1;

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Number of bytes in the data chunk. */
  dataLength: number;
  /** Duration in seconds, derived from the data chunk size. */
  durationSeconds: number;
}

function readTag(buf: Buffer, offset: number) {
  return buf.toString("ascii", offset, offset + 4);
}

/**
 * Parse a WAV buffer's header and locate the data chunk. Throws if the buffer
 * is not a PCM WAV. Tolerates extra chunks (LIST, fact, etc.) before `data`.
 */
export function parseWav(buf: Buffer): WavInfo {
  if (buf.length < 12 || readTag(buf, 0) !== "RIFF" || readTag(buf, 8) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }

  let offset = 12;
  let fmt:
    | { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number }
    | undefined;
  let dataLength: number | undefined;

  while (offset + 8 <= buf.length) {
    const id = readTag(buf, offset);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === "fmt ") {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      // Clamp to the actual bytes present in case the header over-reports.
      dataLength = Math.min(size, buf.length - body);
      break;
    }

    // Chunks are word-aligned (padded to even length).
    offset = body + size + (size % 2);
  }

  if (!fmt) throw new Error("Missing fmt chunk");
  if (dataLength === undefined) throw new Error("Missing data chunk");

  const bytesPerSample = fmt.bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * fmt.channels;
  const durationSeconds =
    bytesPerFrame > 0 ? dataLength / (fmt.sampleRate * bytesPerFrame) : 0;

  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bitsPerSample,
    dataLength,
    durationSeconds,
  };
}

/** Build a canonical 44-byte WAV header for the given PCM parameters. */
function wavHeader(opts: {
  dataLength: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}): Buffer {
  const { dataLength, sampleRate, channels, bitsPerSample } = opts;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLength, 40);
  return header;
}

/** Wrap raw PCM samples in a WAV container. */
export function pcmToWav(
  pcm: Buffer,
  opts?: { sampleRate?: number; channels?: number; bitsPerSample?: number },
): Buffer {
  const sampleRate = opts?.sampleRate ?? TARGET_SAMPLE_RATE;
  const channels = opts?.channels ?? TARGET_CHANNELS;
  const bitsPerSample = opts?.bitsPerSample ?? TARGET_BITS_PER_SAMPLE;
  return Buffer.concat([
    wavHeader({ dataLength: pcm.length, sampleRate, channels, bitsPerSample }),
    pcm,
  ]);
}

/** Build a silent 16-bit PCM WAV of the given duration (used for placeholder takes). */
export function makeSilentWav(
  seconds: number,
  opts?: { sampleRate?: number; channels?: number },
): Buffer {
  const sampleRate = opts?.sampleRate ?? TARGET_SAMPLE_RATE;
  const channels = opts?.channels ?? TARGET_CHANNELS;
  const frames = Math.max(0, Math.round(seconds * sampleRate));
  const pcm = Buffer.alloc(frames * channels * (TARGET_BITS_PER_SAMPLE / 8));
  return pcmToWav(pcm, { sampleRate, channels });
}
