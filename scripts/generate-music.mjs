/**
 * Generate the bundled background-music starter pack.
 *
 * Synthesized from scratch here → 100% original, released as CC0 / public domain
 * (no third-party licensing). Re-run with `npm run gen:music`.
 *
 * These are real little arrangements — arpeggiated plucks with proper attack/decay
 * envelopes, a bass line, and (where it fits) soft percussion over a chord
 * progression — not sustained drones. Seamless looping is achieved by writing
 * every note into a fixed-length buffer with modulo wrap-around, so any note tail
 * crossing the loop boundary continues at the start with no click.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const SR = 32000;
const LOOP = 16; // seconds
const N = SR * LOOP;

// Deterministic PRNG so percussion noise is reproducible across runs.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noteFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Add a pitched note (sum of harmonics) with a pluck/decay envelope, wrapping the tail. */
function addNote(buf, { freq, start, dur, gain, partials, attack = 0.005, decay }) {
  const s = Math.floor(start * SR);
  const len = Math.floor(dur * SR);
  const a = Math.max(1, attack * SR);
  const d = decay * SR;
  for (let i = 0; i < len; i++) {
    const env = i < a ? i / a : Math.exp(-(i - a) / d);
    if (env < 0.0005) continue;
    let v = 0;
    for (let h = 0; h < partials.length; h++) {
      v += partials[h] * Math.sin(2 * Math.PI * freq * (h + 1) * (i / SR));
    }
    buf[(s + i) % N] += v * env * gain;
  }
}

/** Add a soft percussion tick (filtered noise burst) with a fast decay. */
function addTick(buf, { start, dur, gain, decay, rng }) {
  const s = Math.floor(start * SR);
  const len = Math.floor(dur * SR);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i / (decay * SR));
    // Low-passed noise so it's a soft "tick", not a harsh click.
    last = last * 0.6 + (rng() * 2 - 1) * 0.4;
    buf[(s + i) % N] += last * env * gain;
  }
}

/** Add a quiet sustained pad for warmth (low gain, gentle tremolo, seamless). */
function addPad(buf, { midis, gain }) {
  const lfo = 0.1875; // multiple of 1/LOOP → seamless
  for (const m of midis) {
    const f = noteFreq(m);
    for (let n = 0; n < N; n++) {
      const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * lfo * (n / SR));
      buf[n] += Math.sin(2 * Math.PI * f * (n / SR)) * gain * trem;
    }
  }
}

function normalize(buf, dbfs) {
  let peak = 0;
  for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(buf[n]));
  const g = peak > 0 ? Math.pow(10, dbfs / 20) / peak : 0;
  const out = Buffer.alloc(N * 2);
  for (let n = 0; n < N; n++) {
    const v = Math.max(-1, Math.min(1, buf[n] * g));
    out.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), n * 2);
  }
  return out;
}

const PLUCK = [1, 0.5, 0.28, 0.14];
const BELL = [1, 0.6, 0.35, 0.2, 0.1];

// --- Track builders ---

function lofiChill() {
  const buf = new Float32Array(N);
  // Fmaj7 → Em7 → Dm7 → Cmaj7, 4s each. [bassMidi, [chord tone midis]]
  const prog = [
    [41, [53, 57, 60, 64]],
    [40, [52, 55, 59, 62]],
    [38, [50, 53, 57, 60]],
    [36, [48, 52, 55, 59]],
  ];
  prog.forEach(([bass, tones], c) => {
    const t0 = c * 4;
    addPad(buf, { midis: tones, gain: 0.05 });
    addNote(buf, { freq: noteFreq(bass), start: t0, dur: 2.2, gain: 0.5, partials: [1, 0.4], decay: 1.2 });
    addNote(buf, { freq: noteFreq(bass), start: t0 + 2, dur: 2, gain: 0.4, partials: [1, 0.4], decay: 1.0 });
    // Up-and-down arpeggio in eighth notes.
    const seq = [tones[0], tones[1], tones[2], tones[3], tones[2], tones[1], tones[2], tones[3]];
    seq.forEach((m, i) => {
      addNote(buf, { freq: noteFreq(m + 12), start: t0 + i * 0.5, dur: 0.55, gain: 0.32, partials: PLUCK, decay: 0.45 });
    });
  });
  return normalize(buf, -7);
}

function techMinimal() {
  const buf = new Float32Array(N);
  const rng = mulberry32(1337);
  // Am7 (0-8s) and Cmaj7 (8-16s), driving 16th arp.
  const chords = [
    [33, [57, 60, 64, 67]],
    [36, [60, 64, 67, 71]],
  ];
  chords.forEach(([bass, tones], c) => {
    const t0 = c * 8;
    addPad(buf, { midis: tones.map((m) => m - 12), gain: 0.04 });
    // Sixteenth-note sequencer arp.
    for (let i = 0; i < 32; i++) {
      const m = tones[i % tones.length];
      addNote(buf, { freq: noteFreq(m), start: t0 + i * 0.25, dur: 0.28, gain: 0.26, partials: PLUCK, decay: 0.16 });
    }
    // Bass on quarter notes.
    for (let i = 0; i < 8; i++) {
      addNote(buf, { freq: noteFreq(bass), start: t0 + i, dur: 0.9, gain: 0.5, partials: [1, 0.5, 0.2], decay: 0.5 });
    }
    // Soft hats on the off-beats.
    for (let i = 0; i < 16; i++) {
      addTick(buf, { start: t0 + 0.25 + i * 0.5, dur: 0.08, gain: 0.12, decay: 0.02, rng });
    }
  });
  return normalize(buf, -7);
}

function ambientGlow() {
  const buf = new Float32Array(N);
  // Cadd9 (0-8s) and Fadd9 (8-16s): airy bells over a soft pad, sparse.
  const sections = [
    [[60, 64, 67, 74]],
    [[53, 57, 60, 67]],
  ];
  sections.forEach(([tones], c) => {
    const t0 = c * 8;
    addPad(buf, { midis: [tones[0] - 12, tones[1] - 12], gain: 0.1 });
    // Slow bell arpeggio with long, shimmering tails.
    tones.forEach((m, i) => {
      addNote(buf, { freq: noteFreq(m + 12), start: t0 + i * 1.6, dur: 3, gain: 0.3, partials: BELL, attack: 0.01, decay: 1.6 });
      addNote(buf, { freq: noteFreq(m + 12), start: t0 + 4 + i * 0.8, dur: 2, gain: 0.18, partials: BELL, attack: 0.01, decay: 1.2 });
    });
  });
  return normalize(buf, -8);
}

function upbeatDrive() {
  const buf = new Float32Array(N);
  const rng = mulberry32(2024);
  // C → G → Am → F, bright major-key drive with a syncopated bass and hats.
  const prog = [
    [48, [64, 67, 72, 76]],
    [43, [62, 67, 71, 74]],
    [45, [64, 69, 72, 76]],
    [41, [65, 69, 72, 77]],
  ];
  prog.forEach(([bass, tones], c) => {
    const t0 = c * 2;
    // Punchy quarter-note bass with a syncopated eighth push.
    addNote(buf, { freq: noteFreq(bass), start: t0, dur: 0.4, gain: 0.55, partials: [1, 0.5, 0.25], decay: 0.3 });
    addNote(buf, { freq: noteFreq(bass), start: t0 + 0.75, dur: 0.3, gain: 0.4, partials: [1, 0.5], decay: 0.22 });
    addNote(buf, { freq: noteFreq(bass), start: t0 + 1, dur: 0.4, gain: 0.5, partials: [1, 0.5, 0.25], decay: 0.3 });
    addNote(buf, { freq: noteFreq(bass), start: t0 + 1.5, dur: 0.4, gain: 0.42, partials: [1, 0.5], decay: 0.25 });
    // Sixteenth-note plucked arp, driving and bright.
    const seq = [tones[0], tones[1], tones[2], tones[1], tones[3], tones[2], tones[1], tones[2]];
    seq.forEach((m, i) => {
      addNote(buf, { freq: noteFreq(m), start: t0 + i * 0.25, dur: 0.24, gain: 0.24, partials: PLUCK, decay: 0.14 });
    });
    // Bright hats on every eighth.
    for (let i = 0; i < 4; i++) {
      addTick(buf, { start: t0 + i * 0.5, dur: 0.05, gain: 0.14, decay: 0.015, rng });
    }
  });
  return normalize(buf, -6);
}

function cinematicTension() {
  const buf = new Float32Array(N);
  // Cm - Ab, low sustained pad + a slow rising lead + sparse dramatic low hits.
  const sections = [
    { bass: 36, pad: [48, 51, 55], lead: 60 },
    { bass: 32, pad: [44, 47, 51], lead: 63 },
  ];
  sections.forEach(({ bass, pad, lead }, c) => {
    const t0 = c * 8;
    addPad(buf, { midis: pad, gain: 0.09 });
    addNote(buf, { freq: noteFreq(bass), start: t0, dur: 7.5, gain: 0.4, partials: [1, 0.3], decay: 4, attack: 0.3 });
    // Slow rising lead across the section, half steps up.
    for (let i = 0; i < 4; i++) {
      addNote(buf, {
        freq: noteFreq(lead + i),
        start: t0 + i * 2,
        dur: 2.2,
        gain: 0.16 + i * 0.03,
        partials: BELL,
        attack: 0.4,
        decay: 1.8,
      });
    }
    // One low dramatic hit per section.
    addNote(buf, { freq: noteFreq(bass - 12), start: t0 + 0.1, dur: 1.5, gain: 0.5, partials: [1, 0.6, 0.2], decay: 1.1, attack: 0.02 });
  });
  return normalize(buf, -8);
}

function playfulBounce() {
  const buf = new Float32Array(N);
  const rng = mulberry32(77);
  // C major pentatonic bounce, staccato marimba-style plucks with a light skip beat.
  const notes = [60, 64, 67, 72, 76, 72, 67, 64];
  for (let bar = 0; bar < 4; bar++) {
    const t0 = bar * 2;
    notes.forEach((m, i) => {
      addNote(buf, { freq: noteFreq(m), start: t0 + i * 0.25, dur: 0.18, gain: 0.3, partials: [1, 0.3, 0.15], decay: 0.1, attack: 0.002 });
    });
    addNote(buf, { freq: noteFreq(48), start: t0, dur: 0.5, gain: 0.4, partials: [1, 0.4], decay: 0.3 });
    addNote(buf, { freq: noteFreq(48), start: t0 + 1, dur: 0.5, gain: 0.35, partials: [1, 0.4], decay: 0.3 });
    for (let i = 0; i < 2; i++) {
      addTick(buf, { start: t0 + 0.5 + i * 1, dur: 0.06, gain: 0.16, decay: 0.02, rng });
    }
  }
  return normalize(buf, -7);
}

function warmAcoustic() {
  const buf = new Float32Array(N);
  // D - A - Bm - G, gentle fingerstyle-like rolling arpeggio, warm and open.
  const prog = [
    [38, [62, 66, 69, 74]],
    [33, [61, 64, 69, 73]],
    [35, [62, 66, 71, 74]],
    [31, [62, 67, 71, 74]],
  ];
  prog.forEach(([bass, tones], c) => {
    const t0 = c * 4;
    addPad(buf, { midis: tones.map((m) => m - 12), gain: 0.05 });
    addNote(buf, { freq: noteFreq(bass), start: t0, dur: 3.6, gain: 0.35, partials: [1, 0.3], decay: 2, attack: 0.02 });
    const seq = [tones[0], tones[2], tones[1], tones[3], tones[0], tones[2], tones[1], tones[3]];
    seq.forEach((m, i) => {
      addNote(buf, { freq: noteFreq(m), start: t0 + i * 0.5, dur: 0.7, gain: 0.22, partials: PLUCK, attack: 0.01, decay: 0.6 });
    });
  });
  return normalize(buf, -8);
}

const TRACKS = {
  "lofi-chill": lofiChill,
  "tech-minimal": techMinimal,
  "ambient-glow": ambientGlow,
  "upbeat-drive": upbeatDrive,
  "cinematic-tension": cinematicTension,
  "playful-bounce": playfulBounce,
  "warm-acoustic": warmAcoustic,
};

const outDir = path.join(process.cwd(), "public", "music");
await fs.mkdir(outDir, { recursive: true });

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

for (const [id, build] of Object.entries(TRACKS)) {
  const file = path.join(outDir, `${id}.wav`);
  await fs.writeFile(file, wav(build()));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
console.log("Done. Tracks are original, CC0 / public domain.");
