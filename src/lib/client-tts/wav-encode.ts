/**
 * Browser-side audio helpers for client TTS: resample to the pipeline's target
 * rate and encode a mono 16-bit PCM WAV, then base64 for upload. Keeping the
 * output at 44.1 kHz / mono / 16-bit matches what the server providers return,
 * so a browser-generated take is byte-compatible with the rest of the pipeline.
 */

export const TARGET_SAMPLE_RATE = 44100;

/** Linear resample a mono Float32 buffer from srcRate to dstRate. */
export function resampleLinear(
  input: Float32Array,
  srcRate: number,
  dstRate: number,
): Float32Array {
  if (srcRate === dstRate || input.length === 0) return input;
  const ratio = srcRate / dstRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

/** Encode mono Float32 samples as a 16-bit PCM WAV (RIFF) ArrayBuffer. */
export function encodeWavPcm16(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

/** A short silent 16-bit PCM WAV (for empty scenes, so timing stays sensible). */
export function silentWavBase64(seconds = 0.6): string {
  const samples = new Float32Array(Math.round(seconds * TARGET_SAMPLE_RATE));
  return arrayBufferToBase64(encodeWavPcm16(samples, TARGET_SAMPLE_RATE));
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...(bytes.subarray(i, i + chunk) as unknown as number[]),
    );
  }
  return btoa(binary);
}

/**
 * Decode any browser-playable audio blob (e.g. MediaRecorder WebM/Opus) to a
 * mono 16-bit PCM WAV File. VoiceForge validates uploads with libsndfile, which
 * cannot read WebM — WAV is the reliable interchange format.
 */
export async function audioBlobToWavFile(
  blob: Blob,
  filename = "recording.wav",
  sampleRate = TARGET_SAMPLE_RATE,
): Promise<{ file: File; durationSeconds: number }> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const raw = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(raw.slice(0));
    const channels = decoded.numberOfChannels;
    const length = decoded.length;
    const mono = new Float32Array(length);
    for (let c = 0; c < channels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }
    const resampled = resampleLinear(mono, decoded.sampleRate, sampleRate);
    const wav = encodeWavPcm16(resampled, sampleRate);
    return {
      file: new File([wav], filename, { type: "audio/wav" }),
      durationSeconds: resampled.length / sampleRate,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}
