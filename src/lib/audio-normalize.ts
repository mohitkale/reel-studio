/**
 * Loudness normalization for stitched voice takes.
 *
 * Different providers/voices (Cartesia, ElevenLabs, Kokoro, …) return audio at
 * very different levels, so one take can be much quieter than the next. This
 * brings every take to a consistent speech loudness: it measures a gated RMS
 * (ignoring the silent gaps between scenes) and applies a single gain toward a
 * target, capped so the peak never clips. It is a pragmatic speech-loudness pass,
 * not a full ITU-R BS.1770 / LUFS meter, but it keeps levels consistent at
 * near-zero cost. Operates on 16-bit PCM WAV (the pipeline's format); other
 * formats pass through untouched. Gain-only, so it never changes timing.
 */
import { parseWav, pcmToWav } from "./wav";

/** Target speech loudness (gated RMS), in dBFS. */
const TARGET_RMS_DBFS = -18;
/** Never let the peak exceed this, to avoid clipping. */
const PEAK_CEILING_DBFS = -1;
/** Samples quieter than this are treated as silence and excluded from the RMS. */
const SILENCE_FLOOR = 0.005; // ~ -46 dBFS
/** Don't amplify a near-silent track into a wall of noise. */
const MAX_GAIN = 32; // +30 dB

const dbToLinear = (db: number) => Math.pow(10, db / 20);

/**
 * Return the WAV normalized to the target loudness, or the original buffer when
 * it is already on target, silent, or not 16-bit PCM.
 */
export function normalizeWavLoudness(wav: Buffer): Buffer {
  let info;
  try {
    info = parseWav(wav);
  } catch {
    return wav;
  }
  if (info.bitsPerSample !== 16) return wav;

  const pcm = wav.subarray(info.dataOffset, info.dataOffset + info.dataLength);
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount === 0) return wav;

  let peak = 0;
  let sumSquares = 0;
  let counted = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm.readInt16LE(i * 2) / 32768;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    if (abs >= SILENCE_FLOOR) {
      sumSquares += sample * sample;
      counted += 1;
    }
  }
  if (peak === 0 || counted === 0) return wav; // silence

  const rms = Math.sqrt(sumSquares / counted);
  const peakCeiling = dbToLinear(PEAK_CEILING_DBFS);

  let gain = dbToLinear(TARGET_RMS_DBFS) / rms;
  if (peak * gain > peakCeiling) gain = peakCeiling / peak; // peak limit
  gain = Math.min(gain, MAX_GAIN);
  if (Math.abs(gain - 1) < 0.02) return wav; // already close enough

  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < sampleCount; i++) {
    const v = Math.max(-1, Math.min(1, (pcm.readInt16LE(i * 2) / 32768) * gain));
    out.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), i * 2);
  }
  return pcmToWav(out, {
    sampleRate: info.sampleRate,
    channels: info.channels,
    bitsPerSample: 16,
  });
}
