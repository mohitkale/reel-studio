import type { Viseme } from "@/video/visemes";

/**
 * The presenter characters (roadmap P1). Each is a layered SVG rig made of
 * named parts, generated from a few parameters, so adding a character means
 * adding one entry below (docs/CONTRIBUTING_PRESENTERS.md). All artwork is
 * original, drawn in code for this project, and released under the repository's
 * MIT licence (recorded in docs/LICENSING.md).
 *
 * The rig is a 400 x 500 box, drawn bottom to top:
 *   body, neck, head (with ears), hair-back, face parts, hair-front, accessory.
 * Named groups the animation drives: `pres-head` (nods and sway), `pres-eyes-open`,
 * `pres-eyes-closed`, `pres-brows`, and `pres-mouth-<viseme>` for each of the
 * twelve mouth shapes.
 */
export type CharacterStyle = "flat" | "line" | "3d" | "mascot";

export interface Character {
  id: string;
  name: string;
  style: CharacterStyle;
  /** The local voice that suits the character. */
  voiceId: string;
  description: string;
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  /** Outline and mouth-interior colour. */
  ink: string;
  hairStyle: "bun" | "short" | "long" | "bald" | "cap" | "antenna";
  accessory?: "glasses" | "beard" | "headphones" | "none";
}

export const CHARACTERS: readonly Character[] = [
  {
    id: "maya",
    name: "Maya",
    style: "flat",
    voiceId: "af_heart",
    description: "A friendly flat-colour host with a bun.",
    skin: "#e8b48a",
    hair: "#3b2a2a",
    shirt: "#7c5cff",
    accent: "#ffd166",
    ink: "#2b1d1d",
    hairStyle: "bun",
    accessory: "none",
  },
  {
    id: "sam",
    name: "Sam",
    style: "flat",
    voiceId: "am_michael",
    description: "A steady flat-colour presenter with glasses.",
    skin: "#c98f68",
    hair: "#1f2430",
    shirt: "#16a085",
    accent: "#f4f1de",
    ink: "#1a1a1a",
    hairStyle: "short",
    accessory: "glasses",
  },
  {
    id: "ada",
    name: "Ada",
    style: "line",
    voiceId: "bf_emma",
    description: "A line-art host with long hair, drawn in one stroke weight.",
    skin: "#fdf3e7",
    hair: "#fdf3e7",
    shirt: "#fdf3e7",
    accent: "#ff6b6b",
    ink: "#1d1d2b",
    hairStyle: "long",
    accessory: "none",
  },
  {
    id: "rex",
    name: "Rex",
    style: "line",
    voiceId: "bm_george",
    description: "A line-art presenter with a beard and headphones.",
    skin: "#fdf3e7",
    hair: "#fdf3e7",
    shirt: "#fdf3e7",
    accent: "#4dabf7",
    ink: "#1d1d2b",
    hairStyle: "short",
    accessory: "beard",
  },
  {
    id: "orb",
    name: "Orb",
    style: "3d",
    voiceId: "af_nova",
    description: "A softly shaded, glossy 3D-look presenter.",
    skin: "#f1c9a5",
    hair: "#6b3f2a",
    shirt: "#ff7a59",
    accent: "#ffe0d2",
    ink: "#2b1d1d",
    hairStyle: "short",
    accessory: "none",
  },
  {
    id: "bolt",
    name: "Bolt",
    style: "mascot",
    voiceId: "am_adam",
    description: "A round robot mascot with an antenna and big eyes.",
    skin: "#8ecae6",
    hair: "#219ebc",
    shirt: "#ffb703",
    accent: "#fb8500",
    ink: "#12263a",
    hairStyle: "antenna",
    accessory: "headphones",
  },
];

export function getCharacter(id: string | undefined): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/** Mix a #rrggbb colour toward white (amount > 0 of the way) for the highlight of the 3D look. */
function lighten(hex: string, amount: number): string {
  return mix(hex, 255, amount);
}
function darken(hex: string, amount: number): string {
  return mix(hex, 0, amount);
}
function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((n >> shift) & 255) * (1 - amount) + target * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

const CX = 200;
const CY = 316;

/** The twelve mouth shapes, drawn for a character's style. Every shape is centred on (200, 316). */
export function mouthShape(viseme: Viseme, c: Character): string {
  const dark = c.style === "line" ? "none" : c.ink;
  const fill = (extra = "") =>
    `fill="${dark}" stroke="${c.ink}" stroke-width="${c.style === "line" ? 5 : 3}"${extra}`;
  const tongue = c.style === "line" ? "none" : "#e8707a";
  const teeth = c.style === "line" ? "#ffffff" : "#ffffff";
  const big = c.style === "mascot" ? 1.2 : 1;
  const e = (rx: number, ry: number, y = CY) =>
    `<ellipse cx="${CX}" cy="${y}" rx="${rx * big}" ry="${ry * big}" ${fill()}/>`;
  switch (viseme) {
    case "rest":
      return `<path d="M${CX - 28 * big} ${CY - 4} Q${CX} ${CY + 12 * big} ${CX + 28 * big} ${CY - 4}" fill="none" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/>`;
    case "ah":
      return `${e(30, 30)}<ellipse cx="${CX}" cy="${CY + 14 * big}" rx="${18 * big}" ry="${9 * big}" fill="${tongue}"/>`;
    case "eh":
      return `${e(30, 15)}<ellipse cx="${CX}" cy="${CY + 7 * big}" rx="${14 * big}" ry="${5 * big}" fill="${tongue}"/>`;
    case "ee":
      return `<rect x="${CX - 36 * big}" y="${CY - 9 * big}" width="${72 * big}" height="${18 * big}" rx="${9 * big}" ${fill()}/><rect x="${CX - 30 * big}" y="${CY - 8 * big}" width="${60 * big}" height="${7 * big}" rx="3" fill="${teeth}"/>`;
    case "oh":
      return e(18, 26);
    case "oo":
      return `<circle cx="${CX}" cy="${CY}" r="${11 * big}" ${fill()}/>`;
    case "mbp":
      return `<path d="M${CX - 26 * big} ${CY} L${CX + 26 * big} ${CY}" stroke="${c.ink}" stroke-width="9" stroke-linecap="round"/>`;
    case "fv":
      return `<path d="M${CX - 28 * big} ${CY - 8} Q${CX} ${CY - 14} ${CX + 28 * big} ${CY - 8} L${CX + 24 * big} ${CY + 8} Q${CX} ${CY + 14} ${CX - 24 * big} ${CY + 8} Z" ${fill()}/><rect x="${CX - 22 * big}" y="${CY - 10}" width="${44 * big}" height="9" rx="3" fill="${teeth}"/>`;
    case "l":
      return `${e(26, 14)}<ellipse cx="${CX}" cy="${CY - 4 * big}" rx="${10 * big}" ry="${5 * big}" fill="${tongue}"/>`;
    case "sz":
      return `<rect x="${CX - 28 * big}" y="${CY - 8 * big}" width="${56 * big}" height="${16 * big}" rx="${7 * big}" ${fill()}/><rect x="${CX - 25 * big}" y="${CY - 7 * big}" width="${50 * big}" height="${14 * big}" rx="6" fill="${teeth}"/><path d="M${CX - 25 * big} ${CY} L${CX + 25 * big} ${CY}" stroke="${c.ink}" stroke-width="2"/>`;
    case "r":
      return e(20, 14);
    case "sh":
      return `<ellipse cx="${CX}" cy="${CY}" rx="${16 * big}" ry="${17 * big}" ${fill()}/><ellipse cx="${CX}" cy="${CY - 5 * big}" rx="${9 * big}" ry="${4 * big}" fill="${teeth}"/>`;
  }
}

/** Static art behind the face: body, neck, head and the hair at the back. */
export function backLayer(c: Character): string {
  const line = c.style === "line";
  const stroke = line
    ? `stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"`
    : "";
  const skin = c.style === "3d" ? "url(#pres-skin)" : c.skin;
  const shirt = c.style === "3d" ? "url(#pres-shirt)" : c.shirt;
  const headShape =
    c.style === "mascot"
      ? `<rect x="92" y="130" width="216" height="210" rx="86" fill="${skin}" ${stroke}/>`
      : `<ellipse cx="200" cy="245" rx="102" ry="118" fill="${skin}" ${stroke}/><ellipse cx="96" cy="258" rx="16" ry="26" fill="${skin}" ${stroke}/><ellipse cx="304" cy="258" rx="16" ry="26" fill="${skin}" ${stroke}/>`;
  const hairBack =
    c.hairStyle === "long"
      ? `<path d="M92 230 Q86 110 200 100 Q314 110 308 230 L318 420 L82 420 Z" fill="${c.hair}" ${stroke}/>`
      : c.hairStyle === "bun"
        ? `<circle cx="200" cy="84" r="40" fill="${c.hair}" ${stroke}/>`
        : "";
  return `<g id="pres-back">
${c.style === "3d" ? `<defs><radialGradient id="pres-skin" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${lighten(c.skin, 0.35)}"/><stop offset=".45" stop-color="${c.skin}"/><stop offset="1" stop-color="${darken(c.skin, 0.22)}"/></radialGradient><linearGradient id="pres-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.shirt}"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>` : ""}
<path d="M40 500 Q44 392 150 372 L250 372 Q356 392 360 500 Z" fill="${shirt}" ${stroke}/>
<rect x="170" y="330" width="60" height="56" rx="20" fill="${skin}" ${stroke}/>
${hairBack}
<g id="pres-head">
${headShape}
</g></g>`;
}

/** The face and the hair in front, moved together as the head. Mouth shapes are added by the caller. */
export function faceLayer(
  c: Character,
  parts: { mouths: boolean; eyesClosed: boolean } = {
    mouths: true,
    eyesClosed: true,
  },
): string {
  const mascot = c.style === "mascot";
  const eyeY = mascot ? 238 : 232;
  const eyeR = mascot ? 26 : 13;
  const white = c.style === "line" ? "#ffffff" : "#ffffff";
  const eyeOpen = `<g id="pres-eyes-open">
<circle cx="150" cy="${eyeY}" r="${eyeR + (mascot ? 0 : 6)}" fill="${white}" stroke="${c.ink}" stroke-width="${c.style === "line" ? 5 : 2}"/>
<circle cx="250" cy="${eyeY}" r="${eyeR + (mascot ? 0 : 6)}" fill="${white}" stroke="${c.ink}" stroke-width="${c.style === "line" ? 5 : 2}"/>
<circle cx="${mascot ? 154 : 152}" cy="${eyeY + 1}" r="${mascot ? 13 : 8}" fill="${c.ink}"/>
<circle cx="${mascot ? 254 : 252}" cy="${eyeY + 1}" r="${mascot ? 13 : 8}" fill="${c.ink}"/>
<circle cx="${mascot ? 159 : 155}" cy="${eyeY - 4}" r="3" fill="#fff"/><circle cx="${mascot ? 259 : 255}" cy="${eyeY - 4}" r="3" fill="#fff"/>
</g>`;
  const eyeClosed = `<g id="pres-eyes-closed" opacity="0"><path d="M${150 - eyeR - 4} ${eyeY} Q150 ${eyeY + 12} ${150 + eyeR + 4} ${eyeY}" fill="none" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/><path d="M${250 - eyeR - 4} ${eyeY} Q250 ${eyeY + 12} ${250 + eyeR + 4} ${eyeY}" fill="none" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/></g>`;
  const brows = `<g id="pres-brows"><path d="M120 ${eyeY - 40} Q150 ${eyeY - 50} 180 ${eyeY - 40}" fill="none" stroke="${c.style === "mascot" ? c.hair : c.ink}" stroke-width="8" stroke-linecap="round"/><path d="M220 ${eyeY - 40} Q250 ${eyeY - 50} 280 ${eyeY - 40}" fill="none" stroke="${c.style === "mascot" ? c.hair : c.ink}" stroke-width="8" stroke-linecap="round"/></g>`;
  const cheeks =
    c.style === "line"
      ? ""
      : `<circle cx="118" cy="290" r="14" fill="${c.accent}" opacity=".35"/><circle cx="282" cy="290" r="14" fill="${c.accent}" opacity=".35"/>`;
  const stroke =
    c.style === "line"
      ? `stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"`
      : "";
  const hairFront =
    c.hairStyle === "bun" || c.hairStyle === "long"
      ? `<path d="M96 220 Q92 118 200 112 Q308 118 304 220 Q270 160 200 156 Q130 160 96 220 Z" fill="${c.hair}" ${stroke}/>`
      : c.hairStyle === "short"
        ? `<path d="M100 214 Q96 124 200 120 Q304 124 300 214 Q286 170 200 166 Q114 170 100 214 Z" fill="${c.hair}" ${stroke}/>`
        : c.hairStyle === "cap"
          ? `<path d="M94 200 Q100 110 200 108 Q300 110 306 200 Z" fill="${c.accent}" ${stroke}/>`
          : c.hairStyle === "antenna"
            ? `<path d="M200 130 L200 92" stroke="${c.hair}" stroke-width="8" stroke-linecap="round"/><circle cx="200" cy="84" r="14" fill="${c.accent}" stroke="${c.ink}" stroke-width="3"/>`
            : "";
  const accessory =
    c.accessory === "glasses"
      ? `<g fill="none" stroke="${c.ink}" stroke-width="6"><rect x="108" y="208" width="84" height="56" rx="20"/><rect x="208" y="208" width="84" height="56" rx="20"/><path d="M192 232 L208 232"/></g>`
      : c.accessory === "beard"
        ? `<path d="M110 290 Q112 380 200 392 Q288 380 290 290 Q250 340 200 342 Q150 340 110 290 Z" fill="${c.hair}" ${stroke}/>`
        : c.accessory === "headphones"
          ? `<g><path d="M96 240 Q96 120 200 120 Q304 120 304 240" fill="none" stroke="${c.ink}" stroke-width="12" stroke-linecap="round"/><rect x="80" y="220" width="34" height="62" rx="14" fill="${c.shirt}" stroke="${c.ink}" stroke-width="4"/><rect x="286" y="220" width="34" height="62" rx="14" fill="${c.shirt}" stroke="${c.ink}" stroke-width="4"/></g>`
          : "";
  const nose = `<path d="M200 262 Q192 288 202 290" fill="none" stroke="${c.ink}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`;
  const mouths = (
    [
      "rest",
      "ah",
      "eh",
      "ee",
      "oh",
      "oo",
      "mbp",
      "fv",
      "l",
      "sz",
      "r",
      "sh",
    ] as const
  )
    .map(
      (v) =>
        `<g id="pres-mouth-${v}" opacity="${v === "rest" ? 1 : 0}">${mouthShape(v, c)}</g>`,
    )
    .join("");
  return `<g id="pres-face">${cheeks}${hairFront}${eyeOpen}${parts.eyesClosed ? eyeClosed : ""}${brows}${nose}${parts.mouths ? mouths : ""}${accessory}</g>`;
}

/** The whole rig as one SVG, with every mouth shape present and only `rest` showing. */
export function characterSvg(c: Character): string {
  const back = backLayer(c);
  // The face moves with the head: it is placed inside the head group.
  const withFace = back.replace("</g></g>", `${faceLayer(c)}</g></g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" class="presenter-svg" role="img" aria-label="${c.name}">${withFace}</svg>`;
}

const FRAME =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" class="presenter-svg" aria-hidden="true"';

/**
 * The rig as separate transparent layers for compositions that show and hide
 * whole elements by time instead of scripting one SVG: the still face and body
 * (`base`, with the eyes open and no mouth), a blink (`blink`) and one mouth.
 * `uid` keeps gradient ids unique when a layer appears more than once.
 */
export function characterLayer(
  c: Character,
  layer: "base" | "blink" | Viseme,
  uid = "0",
): string {
  if (layer === "base") {
    const back = backLayer(c).replace(
      "</g></g>",
      `${faceLayer(c, { mouths: false, eyesClosed: false })}</g></g>`,
    );
    const unique = back
      .replace(/url\(#pres-(skin|shirt)\)/g, `url(#pres-$1-${uid})`)
      .replace(/ id="pres-([a-z-]+)"/g, ` id="pres-$1-${uid}"`);
    return `<svg ${FRAME}>${unique}</svg>`;
  }
  if (layer === "blink") {
    const mascot = c.style === "mascot";
    const eyeY = mascot ? 238 : 232;
    const r = (mascot ? 26 : 19) + 3;
    const skin = c.style === "3d" ? c.skin : c.skin;
    const lid = [150, 250]
      .map(
        (x) =>
          `<ellipse cx="${x}" cy="${eyeY}" rx="${r}" ry="${r}" fill="${skin}"/>`,
      )
      .join("");
    const closed = [150, 250]
      .map(
        (x) =>
          `<path d="M${x - r + 2} ${eyeY} Q${x} ${eyeY + 12} ${x + r - 2} ${eyeY}" fill="none" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/>`,
      )
      .join("");
    return `<svg ${FRAME}>${lid}${closed}</svg>`;
  }
  return `<svg ${FRAME}>${mouthShape(layer, c)}</svg>`;
}
