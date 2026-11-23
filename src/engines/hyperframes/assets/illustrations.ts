/**
 * Looping illustrations (roadmap V12b): 65 original vector scenes, drawn by
 * code, so there is no third-party artwork and nothing to attribute (the code is
 * MIT like the rest of the project). Thirteen motifs, five seeded variants each.
 *
 * They are decorative backgrounds behind a scene's panel, coloured by the
 * theme (`--fx-c`, `--fx-glow`, `--fx-ink`). Motion is plain CSS keyframes
 * that loop, so the preview and the exporter drive them the same way as the
 * photo pans (a paused animation seeked with a negative delay).
 */

export const ILLUSTRATION_MOTIFS = [
  "orbits",
  "waves",
  "bubbles",
  "network",
  "bars",
  "rays",
  "leaves",
  "skyline",
  "gears",
  "dots",
  "stars",
  "spiral",
  "clouds",
] as const;
export type IllustrationMotif = (typeof ILLUSTRATION_MOTIFS)[number];

export const VARIANTS_PER_MOTIF = 5;

/** `orbits-1` to `clouds-5`. */
export const ILLUSTRATION_NAMES: string[] = ILLUSTRATION_MOTIFS.flatMap(
  (motif) =>
    Array.from({ length: VARIANTS_PER_MOTIF }, (_, i) => `${motif}-${i + 1}`),
);

/** Words that point at a motif when a storyboard asks for one by meaning. */
const KEYWORDS: Record<IllustrationMotif, string[]> = {
  orbits: ["planet", "orbit", "science", "physics", "atom", "global", "world"],
  waves: ["ocean", "water", "sea", "wave", "sound", "audio", "calm", "flow"],
  bubbles: ["team", "community", "people", "social", "idea", "fun", "drink"],
  network: [
    "tech",
    "ai",
    "data",
    "network",
    "web",
    "code",
    "internet",
    "cloud",
  ],
  bars: ["money", "growth", "chart", "sales", "business", "finance", "stats"],
  rays: ["sun", "energy", "morning", "hope", "light", "start", "motivation"],
  leaves: ["nature", "plant", "coffee", "tea", "garden", "health", "food"],
  skyline: ["city", "building", "urban", "office", "work", "travel", "news"],
  gears: ["process", "engine", "machine", "how", "tool", "system", "build"],
  dots: ["grid", "pattern", "map", "design", "digital", "pixel", "list"],
  stars: ["space", "night", "moon", "star", "dream", "story", "sleep"],
  spiral: ["journey", "focus", "time", "habit", "loop", "mind", "learning"],
  clouds: ["weather", "sky", "overcast", "cloudscape", "mist"],
};

/** An exact name, a motif, or a keyword; null when nothing fits. */
export function resolveIllustration(value: string | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (ILLUSTRATION_NAMES.includes(key)) return key;
  const motif = (ILLUSTRATION_MOTIFS as readonly string[]).includes(key)
    ? (key as IllustrationMotif)
    : ILLUSTRATION_MOTIFS.find((m) => KEYWORDS[m].includes(key));
  return motif ? `${motif}-1` : null;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;
type Gen = (r: () => number) => string;

const orbits: Gen = (r) => {
  const rings = 3 + Math.floor(r() * 2);
  return Array.from({ length: rings }, (_, i) => {
    const rad = 140 + i * 110 + r() * 30;
    const dur = f(14 + i * 6 + r() * 6);
    return `<g class="il-spin" style="animation-duration:${dur}s"><circle cx="500" cy="500" r="${f(rad)}" class="il-line"/><circle cx="${f(500 + rad)}" cy="500" r="${f(14 + r() * 14)}" class="il-fill${i % 2 ? "-b" : ""}"/></g>`;
  }).join("");
};

const waves: Gen = (r) => {
  const layers = 3 + Math.floor(r() * 3);
  const unit = 110 + Math.floor(r() * 110);
  const base = 420 + r() * 220;
  return Array.from({ length: layers }, (_, i) => {
    const y = base + i * (60 + r() * 50);
    const amp = 25 + r() * 80;
    const half = unit * 2;
    const d = `M-200 ${f(y)} q ${unit} ${f(-amp)} ${half} 0 ${Array.from({ length: 8 }, () => `t ${half} 0`).join(" ")} V1200 H-200 Z`;
    return `<path d="${d}" class="il-wave il-sway" style="animation-duration:${f(5 + i * 1.7 + r() * 2)}s;opacity:${f(0.2 + i * 0.09)}"/>`;
  }).join("");
};

const bubbles: Gen = (r) =>
  Array.from({ length: 16 }, () => {
    const rad = 18 + r() * 54;
    return `<circle cx="${f(60 + r() * 880)}" cy="${f(300 + r() * 700)}" r="${f(rad)}" class="il-bubble il-rise" style="animation-duration:${f(6 + r() * 7)}s"/>`;
  }).join("");

const network: Gen = (r) => {
  const pts = Array.from({ length: 11 }, () => [
    60 + r() * 880,
    80 + r() * 840,
  ]);
  const edges = pts
    .flatMap((p, i) =>
      pts
        .slice(i + 1)
        .map((q) => ({ p, q, d: Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) })),
    )
    .filter((e) => e.d < 330)
    .map(
      (e) =>
        `<line x1="${f(e.p[0]!)}" y1="${f(e.p[1]!)}" x2="${f(e.q[0]!)}" y2="${f(e.q[1]!)}" class="il-line il-pulse" style="animation-duration:${f(3 + r() * 4)}s"/>`,
    );
  const nodes = pts.map(
    (p) =>
      `<circle cx="${f(p[0]!)}" cy="${f(p[1]!)}" r="${f(9 + r() * 12)}" class="il-fill il-pulse" style="animation-duration:${f(2.5 + r() * 3)}s"/>`,
  );
  return edges.join("") + nodes.join("");
};

const bars: Gen = (r) =>
  Array.from({ length: 9 }, (_, i) => {
    const h = 160 + r() * 520;
    return `<rect x="${f(90 + i * 95)}" y="${f(900 - h)}" width="64" height="${f(h)}" rx="8" class="il-fill${i % 3 ? "" : "-b"} il-grow" style="animation-duration:${f(4 + r() * 4)}s"/>`;
  }).join("");

const rays: Gen = (r) => {
  const n = 10 + Math.floor(r() * 18);
  const rays = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<line x1="${f(500 + Math.cos(a) * 190)}" y1="${f(500 + Math.sin(a) * 190)}" x2="${f(500 + Math.cos(a) * (420 + (i % 2) * 140))}" y2="${f(500 + Math.sin(a) * (420 + (i % 2) * 140))}" class="il-line il-thick"/>`;
  }).join("");
  return `<g class="il-spin" style="animation-duration:${f(40 + r() * 20)}s">${rays}</g><circle cx="500" cy="500" r="150" class="il-fill il-pulse" style="animation-duration:6s"/>`;
};

const leaves: Gen = (r) =>
  Array.from({ length: 9 }, () => {
    const x = 60 + r() * 880;
    const y = 520 + r() * 440;
    const s = 0.7 + r() * 1.1;
    const rot = -60 + r() * 120;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})"><path d="M0 0 C 40 -90 120 -110 190 -70 C 150 0 70 50 0 0 Z" class="il-fill${r() > 0.5 ? "" : "-b"} il-sway" style="animation-duration:${f(5 + r() * 4)}s"/></g>`;
  }).join("");

const skyline: Gen = (r) => {
  let x = 20;
  const out: string[] = [];
  while (x < 980) {
    const w = 60 + r() * 70;
    const h = 200 + r() * 420;
    out.push(
      `<rect x="${f(x)}" y="${f(960 - h)}" width="${f(w)}" height="${f(h)}" class="il-fill${r() > 0.7 ? "-b" : ""}" style="opacity:.55"/>`,
    );
    for (let wy = 960 - h + 24; wy < 930; wy += 46)
      for (let wx = x + 12; wx < x + w - 18; wx += 26)
        if (r() > 0.55)
          out.push(
            `<rect x="${f(wx)}" y="${f(wy)}" width="12" height="18" class="il-window il-blink" style="animation-duration:${f(3 + r() * 6)}s"/>`,
          );
    x += w + 8;
  }
  return out.join("");
};

const gears: Gen = (r) => {
  const count = 3 + Math.floor(r() * 2);
  return Array.from({ length: count }, (_, i) => {
    const rad = 90 + r() * 130;
    const cx = 160 + r() * 680;
    const cy = 160 + r() * 680;
    const teeth = Math.round(rad / 9);
    const dash = f((2 * Math.PI * (rad + 14)) / teeth / 2);
    return `<g class="${i % 2 ? "il-spin-r" : "il-spin"}" style="animation-duration:${f(16 + i * 6 + r() * 6)}s"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" class="il-line il-thick"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad + 14)}" class="il-line il-teeth" style="stroke-dasharray:${dash} ${dash}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad * 0.3)}" class="il-fill${i % 2 ? "-b" : ""}"/></g>`;
  }).join("");
};

const dots: Gen = (r) => {
  const out: string[] = [];
  const n = 7 + Math.floor(r() * 7);
  const step = 960 / n;
  const phase = r() * 6;
  const dir = r() > 0.5 ? 1 : -1;
  const square = r() > 0.6;
  const size = f(step * (0.12 + r() * 0.14));
  for (let gy = 0; gy < n; gy++)
    for (let gx = 0; gx < n; gx++) {
      const cx = f(step / 2 + 20 + gx * step);
      const cy = f(step / 2 + 20 + gy * step);
      const delay = f(-(gx + dir * gy + n) * 0.2 - phase);
      out.push(
        square
          ? `<rect x="${f(cx - size)}" y="${f(cy - size)}" width="${f(size * 2)}" height="${f(size * 2)}" rx="3" class="il-fill${(gx + gy) % 5 ? "" : "-b"} il-pulse" style="animation-duration:5s;animation-delay:${delay}s"/>`
          : `<circle cx="${cx}" cy="${cy}" r="${size}" class="il-fill${(gx + gy) % 5 ? "" : "-b"} il-pulse" style="animation-duration:5s;animation-delay:${delay}s"/>`,
      );
    }
  return out.join("");
};

const stars: Gen = (r) => {
  const out = Array.from({ length: 40 }, () => {
    const s = 3 + r() * 8;
    return `<circle cx="${f(r() * 1000)}" cy="${f(r() * 1000)}" r="${f(s)}" class="il-fill il-twinkle" style="animation-duration:${f(2 + r() * 4)}s"/>`;
  });
  out.push(
    `<path d="M720 220 a120 120 0 1 0 140 160 a95 95 0 1 1 -140 -160 Z" class="il-fill-b il-float" style="animation-duration:9s"/>`,
  );
  return out.join("");
};

const spiral: Gen = (r) => {
  const turns = 5 + Math.floor(r() * 3);
  let d = "M500 500";
  for (let a = 0; a < turns * Math.PI * 2; a += 0.15) {
    const rad = 14 + a * (60 / (Math.PI * 2)) * 1.6;
    d += ` L${f(500 + Math.cos(a) * rad)} ${f(500 + Math.sin(a) * rad)}`;
  }
  return `<path d="${d}" class="il-line il-thick il-dash"/><circle cx="500" cy="500" r="22" class="il-fill il-pulse"/>`;
};

const clouds: Gen = (r) => {
  const count = 3 + Math.floor(r() * 4);
  return Array.from({ length: count }, (_, i) => {
    const x = 140 + r() * 720;
    const y = 120 + ((i + 0.5) * 760) / count;
    const width = 0.7 + r() * 1.1;
    const height = 0.65 + r() * 0.7;
    const duration = f(12 + r() * 10);
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(width)} ${f(height)})"><g class="il-cloud-drift" style="animation-duration:${duration}s"><path d="M-140 35 C-185 35-175-34-126-37 C-124-92-54-115-18-67 C20-115 98-87 98-41 C150-53 184-19 168 14 C160 33 139 35 117 35Z" class="${i % 2 ? "il-fill-b" : "il-fill"}"/><path d="M-134 24 H116" class="il-window" style="opacity:.24;stroke:var(--fx-ink, #fff);stroke-width:2;stroke-linecap:round"/></g></g>`;
  }).join("");
};

const GENERATORS: Record<IllustrationMotif, Gen> = {
  orbits,
  waves,
  bubbles,
  network,
  bars,
  rays,
  leaves,
  skyline,
  gears,
  dots,
  stars,
  spiral,
  clouds,
};

/** The SVG markup of one illustration, or null for an unknown name. */
export function illustrationSvg(name: string): string | null {
  const match = /^([a-z]+)-([1-5])$/.exec(name);
  const motif = match?.[1] as IllustrationMotif | undefined;
  if (!motif || !GENERATORS[motif]) return null;
  const variant = Number(match![2]);
  let seed = 2166136261 ^ variant;
  for (const ch of motif) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const body = GENERATORS[motif](rng(seed >>> 0));
  return `<svg class="il" data-illustration="${name}" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

/** CSS for every illustration; colours come from the scene's palette. */
export const ILLUSTRATION_STYLES = `
  .fx-illus { position: absolute; inset: 0; z-index: 3; pointer-events: none; overflow: hidden; opacity: .7; }
  .fx-illus .il { width: 100%; height: 100%; display: block; }
  .il * { transform-box: fill-box; transform-origin: center; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
  .il-line { fill: none; stroke: var(--fx-c, #fff); stroke-width: 3; opacity: .7; }
  .il-thick { stroke-width: 6; }
  .il-fill { fill: var(--fx-c, #fff); opacity: .55; }
  .il-fill-b { fill: var(--fx-glow, #9cf); opacity: .5; }
  .il-wave { fill: var(--fx-c, #fff); }
  .il-bubble { fill: none; stroke: var(--fx-glow, #9cf); stroke-width: 4; opacity: .6; }
  .il-window { fill: var(--fx-ink, #fff); }
  .il-spin { animation-name: il-spin; animation-timing-function: linear; }
  .il-spin-r { animation-name: il-spin-r; animation-timing-function: linear; }
  .il-sway { animation-name: il-sway; }
  .il-cloud-drift { animation-name: il-cloud-drift; }
  .il-float { animation-name: il-float; }
  .il-rise { animation-name: il-rise; }
  .il-pulse { animation-name: il-pulse; }
  .il-grow { animation-name: il-grow; transform-origin: 50% 100%; }
  .il-blink { animation-name: il-blink; }
  .il-twinkle { animation-name: il-twinkle; }
  .il-dash { animation-name: il-dash; stroke-dasharray: 2600; }
  @keyframes il-spin { to { transform: rotate(360deg); } }
  @keyframes il-spin-r { to { transform: rotate(-360deg); } }
  @keyframes il-sway { 0%,100% { transform: translateX(-26px) rotate(-3deg); } 50% { transform: translateX(26px) rotate(3deg); } }
  @keyframes il-cloud-drift { 0%,100% { transform: translateX(-38px); } 50% { transform: translateX(38px); } }
  @keyframes il-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-34px); } }
  @keyframes il-rise { 0% { transform: translateY(40px); opacity: 0; } 20%,80% { opacity: .7; } 100% { transform: translateY(-120px); opacity: 0; } }
  @keyframes il-pulse { 0%,100% { transform: scale(1); opacity: .35; } 50% { transform: scale(1.25); opacity: .8; } }
  @keyframes il-grow { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(.72); } }
  @keyframes il-blink { 0%,100% { opacity: .15; } 50% { opacity: .85; } }
  @keyframes il-twinkle { 0%,100% { opacity: .15; transform: scale(.7); } 50% { opacity: .9; transform: scale(1.4); } }
  @keyframes il-dash { 0% { stroke-dashoffset: 2600; } 100% { stroke-dashoffset: 0; } }
`;
