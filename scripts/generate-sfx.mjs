/**
 * Generate a cinematic CC0 / public-domain SFX pack for reel production.
 * Multi-layer synthesis (noise air, body tones, soft saturation) — not toy beeps.
 * Re-run with `npm run gen:sfx`.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const SR = 44100;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writeWav(samples) {
  const n = samples.length;
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

function softClip(x) {
  // Gentle tanh saturation so peaks feel designed, not digital.
  return Math.tanh(x * 1.15) * 0.92;
}

function normalize(buf, peakTarget = 0.72) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak <= 1e-9) return buf;
  const g = peakTarget / peak;
  return buf.map((v) => softClip(v * g));
}

function onePoleLp(input, cutoff) {
  const out = new Float64Array(input.length);
  let y = 0;
  const a = Math.max(0.001, Math.min(0.99, cutoff));
  for (let i = 0; i < input.length; i++) {
    y += a * (input[i] - y);
    out[i] = y;
  }
  return out;
}

function onePoleHp(input, cutoff) {
  const lp = onePoleLp(input, cutoff);
  const out = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] - lp[i];
  return out;
}

function noise(n, seed) {
  const rng = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
  return out;
}

/** Soft cinematic air whoosh — band-swept noise, not a beep. */
function whoosh(dur = 0.62) {
  const n = Math.floor(SR * dur);
  const raw = noise(n, 101);
  const air = onePoleHp(onePoleLp(raw, 0.18), 0.03);
  const body = onePoleLp(raw, 0.08);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Bell envelope with slight late air.
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 1.35);
    const bright = 0.35 + 0.65 * t;
    // Subtle pitchy grit under the air.
    phase += (180 + 420 * t) / SR;
    const grit = Math.sin(2 * Math.PI * phase) * 0.04 * (1 - t);
    out[i] =
      (air[i] * 0.75 * bright + body[i] * 0.35 * (1 - t * 0.5) + grit) * env;
  }
  return normalize(Array.from(out), 0.68);
}

/** Soft cinematic impact — sub + mid body + soft transient. */
function softHit(dur = 0.42) {
  const n = Math.floor(SR * dur);
  const tick = onePoleHp(noise(n, 202), 0.35);
  const out = new Float64Array(n);
  let phaseLo = 0;
  let phaseMid = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const envBoom = Math.exp(-t * 11);
    const envBody = Math.exp(-t * 16);
    const envTick = Math.exp(-t * 70);
    // Pitch drop on the sub.
    const fLo = 58 * Math.exp(-t * 6);
    const fMid = 170 * Math.exp(-t * 9);
    phaseLo += fLo / SR;
    phaseMid += fMid / SR;
    const boom = Math.sin(2 * Math.PI * phaseLo) * envBoom;
    const body = Math.sin(2 * Math.PI * phaseMid) * envBody * 0.45;
    const click = tick[i] * envTick * 0.22;
    out[i] = boom * 0.9 + body + click;
  }
  return normalize(Array.from(out), 0.7);
}

/** Soft UI pop — muted bubble, not an 880Hz sine beep. */
function pop(dur = 0.22) {
  const n = Math.floor(SR * dur);
  const hiss = onePoleHp(onePoleLp(noise(n, 303), 0.22), 0.08);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 22);
    const f = 320 * Math.exp(-t * 8);
    phase += f / SR;
    const tone = Math.sin(2 * Math.PI * phase) * env;
    const air = hiss[i] * Math.exp(-t * 40) * 0.35;
    out[i] = tone * 0.55 + air;
  }
  return normalize(Array.from(out), 0.58);
}

/** Tiny UI tick — high and short; keep gain low by design. */
function click(dur = 0.055) {
  const n = Math.floor(SR * dur);
  const raw = onePoleHp(noise(n, 404), 0.45);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = raw[i] * Math.exp(-t * 160) * 0.55;
  }
  return normalize(Array.from(out), 0.45);
}

/** Tension riser — filtered noise + climbing tone bed. */
function riser(dur = 0.95) {
  const n = Math.floor(SR * dur);
  const raw = noise(n, 505);
  const out = new Float64Array(n);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.pow(t, 1.6);
    const cutoff = 0.02 + 0.28 * t * t;
    lp += cutoff * (raw[i] - lp);
    const freq = 90 + 780 * t * t;
    phase += freq / SR;
    const tone = Math.sin(2 * Math.PI * phase) * 0.18 * env;
    out[i] = lp * env * 0.85 + tone;
  }
  return normalize(Array.from(out), 0.62);
}

/** Soft transition swipe — short air pass. */
function swipe(dur = 0.38) {
  const n = Math.floor(SR * dur);
  const raw = onePoleHp(onePoleLp(noise(n, 606), 0.2), 0.04);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Asymmetric: quick in, soft out.
    const env = Math.sin(Math.PI * Math.pow(t, 0.75));
    out[i] = raw[i] * env * (0.45 + 0.55 * t);
  }
  return normalize(Array.from(out), 0.55);
}

const PACK = [
  { id: "whoosh", fn: whoosh },
  { id: "soft-hit", fn: softHit },
  { id: "pop", fn: pop },
  { id: "click", fn: click },
  { id: "riser", fn: riser },
  { id: "swipe", fn: swipe },
];

const outDir = path.join(process.cwd(), "public", "sfx");
await fs.mkdir(outDir, { recursive: true });

for (const item of PACK) {
  const samples = item.fn();
  const file = path.join(outDir, `${item.id}.wav`);
  await fs.writeFile(file, writeWav(samples));
  console.log(`wrote ${file} (${(samples.length / SR).toFixed(2)}s)`);
}

await fs.writeFile(
  path.join(outDir, "README.md"),
  `# Bundled SFX (CC0)

Cinematic multi-layer synthesis via \`scripts/generate-sfx.mjs\` — original, public domain / CC0.
Re-run with \`npm run gen:sfx\`.
`,
);

console.log("SFX pack ready.");
