/**
 * Bundled icons (roadmap V6): lucide (ISC) as inline SVG, chosen from a
 * storyboard's `icon` or deterministically from the scene's words. No network.
 */
import { LUCIDE_ICONS } from "./lucide-icons.generated";

/** Words that point at an icon. The first icon with the most hits wins. */
const KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  rocket: ["launch", "ship", "start", "rocket", "orbit", "moon"],
  lightbulb: ["idea", "think", "tip", "insight", "clarity", "learn"],
  zap: ["fast", "speed", "quick", "instant", "power", "energy", "electric"],
  target: ["goal", "aim", "focus", "target", "mission"],
  "trending-up": [
    "grow",
    "growth",
    "increase",
    "rise",
    "gain",
    "more",
    "billion",
  ],
  "trending-down": [
    "decline",
    "drop",
    "fall",
    "slow",
    "slowing",
    "less",
    "decrease",
  ],
  "chart-bar": ["chart", "data", "numbers", "statistics", "percent", "compare"],
  users: [
    "team",
    "people",
    "users",
    "community",
    "everyone",
    "friends",
    "customers",
  ],
  heart: ["love", "care", "health", "favorite", "kind"],
  star: ["best", "top", "favorite", "rating", "quality"],
  "shield-check": [
    "safe",
    "secure",
    "security",
    "protect",
    "trust",
    "privacy",
    "leak-proof",
  ],
  lock: ["lock", "private", "password", "encrypt"],
  clock: [
    "time",
    "hour",
    "minute",
    "wait",
    "delay",
    "debounce",
    "deadline",
    "noon",
  ],
  calendar: [
    "day",
    "week",
    "month",
    "year",
    "date",
    "schedule",
    "november",
    "december",
  ],
  moon: ["night", "sleep", "dark", "moon"],
  sun: ["sun", "morning", "bright", "summer", "warm"],
  flame: ["hot", "fire", "heat", "burn", "trending", "boil"],
  droplets: ["water", "rain", "liquid", "drink", "ice", "frozen"],
  leaf: ["plant", "green", "nature", "eco", "organic"],
  globe: ["world", "global", "earth", "planet", "international", "population"],
  plane: ["travel", "flight", "trip"],
  smartphone: ["phone", "mobile", "app", "ios", "android"],
  laptop: ["computer", "laptop", "desktop", "work"],
  code: [
    "code",
    "function",
    "programming",
    "developer",
    "typescript",
    "javascript",
    "api",
  ],
  terminal: ["terminal", "command", "shell", "cli", "install"],
  bug: ["bug", "error", "fix", "debug"],
  "book-open": ["book", "read", "story", "chapter", "lesson"],
  "graduation-cap": ["school", "student", "course", "teach", "tutorial"],
  mail: ["email", "mail", "inbox", "newsletter"],
  "message-circle": ["chat", "talk", "say", "comment", "reply", "message"],
  megaphone: [
    "announce",
    "share",
    "follow",
    "subscribe",
    "join",
    "pre-order",
    "order",
    "tap",
  ],
  mic: ["voice", "podcast", "speak", "audio", "narrat"],
  music: ["music", "song", "beat", "sound"],
  video: ["video", "film", "watch", "clip", "stream"],
  camera: ["photo", "picture", "camera", "image"],
  brain: ["brain", "mind", "memory", "psychology", "myth", "knowledge"],
  coffee: ["coffee", "tea", "brew", "cafe", "morning"],
  utensils: ["food", "cook", "recipe", "kitchen", "pan", "meal", "dinner"],
  dumbbell: ["fitness", "gym", "workout", "exercise", "strength"],
  activity: ["health", "pulse", "heart rate", "activity"],
  "bed-double": ["sleep", "rest", "bed"],
  wifi: ["online", "internet", "network", "connect", "wifi"],
  layers: ["layer", "stack", "wall", "walls", "steel", "double"],
  puzzle: ["puzzle", "piece", "fit", "solve"],
  scale: ["balance", "versus", "compare", "fair", "law", "choose"],
  handshake: ["deal", "partner", "agree", "together"],
  trophy: ["win", "winner", "champion", "success", "achieve"],
  flag: ["milestone", "finish", "goal", "flag"],
  quote: ["quote", "said", "says", "words"],
  "list-checks": ["checklist", "steps", "list", "check", "ways", "tips"],
  gauge: ["measure", "level", "meter", "gauge", "performance"],
  atom: ["science", "physics", "atom", "wave", "waves", "cancel", "particle"],
  telescope: ["space", "star", "astronomy", "discover", "explore"],
  microscope: ["research", "lab", "study", "studies", "experiment"],
  newspaper: ["news", "headline", "report", "recap", "press"],
  headphones: [
    "headphones",
    "listen",
    "noise",
    "hear",
    "earbuds",
    "microphones",
  ],
  "gamepad-2": ["game", "gaming", "play", "level up"],
  palette: ["design", "color", "colour", "style", "creative", "art"],
  anchor: ["harbour", "harbor", "sea", "boat", "port"],
  lamp: ["light", "lamp", "lighthouse", "lit", "bright"],
  hammer: ["build", "make", "craft", "tool", "workshop"],
  package: ["package", "box", "deliver", "shipping", "ship", "pre-order"],
  "shopping-cart": ["buy", "shop", "cart", "store", "purchase"],
  banknote: ["money", "cash", "price", "cost", "pay", "dollar", "save"],
  award: ["award", "prize", "honor"],
  eye: ["see", "look", "view", "visible", "watch"],
  search: ["search", "find", "keystroke", "lookup"],
  settings: ["setting", "settings", "configure", "setup"],
  wrench: ["repair", "maintain", "maintenance"],
  database: ["database", "storage", "records"],
  cpu: ["chip", "processor", "hardware", "machine", "automat"],
  "triangle-alert": ["warning", "careful", "danger", "risk", "stop", "never"],
  "circle-check": [
    "done",
    "correct",
    "right",
    "yes",
    "fact",
    "true",
    "approved",
  ],
  "circle-x": ["wrong", "false", "no", "avoid", "myth"],
  mountain: ["mountain", "climb", "peak", "summit", "stairs", "steps"],
};

/** The icon a scene type falls back to when its words match nothing. */
const TYPE_DEFAULT: Readonly<Record<string, string>> = {
  hook: "sparkles",
  statement: "lightbulb",
  "kinetic-text": "zap",
  list: "list-checks",
  steps: "list-checks",
  checklist: "circle-check",
  stat: "gauge",
  chart: "chart-bar",
  comparison: "scale",
  "before-after": "trending-up",
  timeline: "calendar",
  quote: "quote",
  definition: "book-open",
  code: "code",
  terminal: "terminal",
  diagram: "layers",
  media: "image",
  "media-split": "image",
  "device-mockup": "smartphone",
  cta: "megaphone",
};

export function hasIcon(name: string): boolean {
  return name in LUCIDE_ICONS;
}

export function iconNames(): string[] {
  return Object.keys(LUCIDE_ICONS);
}

/**
 * Deterministic icon for a scene: an explicit valid name wins, then the
 * keyword with the most hits (ties keep list order), then the scene type's
 * default. Always returns an icon that exists.
 */
export function iconForScene(args: {
  text: string;
  type?: string;
  explicit?: string;
}): string {
  if (args.explicit && hasIcon(args.explicit)) return args.explicit;
  const haystack = ` ${args.text.toLowerCase().replace(/[^a-z0-9 -]+/g, " ")} `;
  let best: { name: string; hits: number } | undefined;
  for (const [name, words] of Object.entries(KEYWORDS)) {
    if (!hasIcon(name)) continue;
    let hits = 0;
    for (const word of words) {
      if (haystack.includes(word.length > 4 ? word : ` ${word} `)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { name, hits };
  }
  const fallback = TYPE_DEFAULT[args.type ?? ""] ?? "sparkles";
  return best?.name ?? (hasIcon(fallback) ? fallback : "sparkles");
}

/** Inline SVG for an icon, stroked in the current text colour. */
export function iconSvg(name: string): string {
  const inner = LUCIDE_ICONS[name] ?? LUCIDE_ICONS.sparkles ?? "";
  return `<svg class="fx-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
