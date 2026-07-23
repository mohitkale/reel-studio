/**
 * Browser helpers to time-stretch WAV audio for download at a chosen playback
 * speed (matches HTMLAudioElement.playbackRate behaviour: duration and pitch).
 */

import { encodeWavPcm16 } from "@/lib/client-tts/wav-encode";

export const PLAYBACK_SPEED_MIN = 0.5;
export const PLAYBACK_SPEED_MAX = 2;
export const PLAYBACK_SPEED_STEP = 0.05;
export const PLAYBACK_SPEED_DEFAULT = 1;

function formatSpeedTag(speed: number): string {
  const rounded = Math.round(speed * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Render audio at `rate` via OfflineAudioContext, return a mono 16-bit WAV. */
export async function renderWavAtSpeed(
  source: ArrayBuffer,
  rate: number,
): Promise<Blob> {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid playback speed");
  }
  if (Math.abs(rate - 1) < 0.001) {
    return new Blob([source], { type: "audio/wav" });
  }

  const probe = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await probe.decodeAudioData(source.slice(0));
  } finally {
    void probe.close();
  }

  const sampleRate = decoded.sampleRate;
  const frames = Math.max(1, Math.ceil(decoded.length / rate));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.playbackRate.value = rate;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const mono = rendered.getChannelData(0);
  const wav = encodeWavPcm16(mono, sampleRate);
  return new Blob([wav], { type: "audio/wav" });
}

export async function downloadWavAtSpeed(opts: {
  url: string;
  filename: string;
  speed: number;
}): Promise<void> {
  const res = await fetch(opts.url);
  if (!res.ok) throw new Error(`Could not fetch audio (${res.status})`);
  const buf = await res.arrayBuffer();
  const blob = await renderWavAtSpeed(buf, opts.speed);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    const base = opts.filename.replace(/\.wav$/i, "") || "podcast";
    const speedTag =
      Math.abs(opts.speed - 1) < 0.001
        ? ""
        : `_${formatSpeedTag(opts.speed)}x`;
    a.download = `${base}${speedTag}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
