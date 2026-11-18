/**
 * Text normalisation before text-to-speech (roadmap A2). Plain, deterministic
 * rules: the same text always gives the same spoken text. What the viewer reads
 * on screen is never changed; only what the voice is given.
 */

export interface PronunciationRule {
  /** The word or phrase as written. Matched whole-word, ignoring case. */
  find: string;
  /** How to say it, written the way it sounds. */
  replaceWith: string;
}

/** Common tech and brand terms a voice model tends to get wrong. */
export const STARTER_PRONUNCIATIONS: readonly PronunciationRule[] = [
  { find: "SQL", replaceWith: "sequel" },
  { find: "GIF", replaceWith: "jiff" },
  { find: "nginx", replaceWith: "engine X" },
  { find: "kubectl", replaceWith: "cube control" },
  { find: "Kubernetes", replaceWith: "koo-ber-NET-eez" },
  { find: "GitHub", replaceWith: "git hub" },
  { find: "npm", replaceWith: "N P M" },
  { find: "macOS", replaceWith: "mac O S" },
  { find: "iOS", replaceWith: "eye O S" },
  { find: "OAuth", replaceWith: "oh auth" },
  { find: "JSON", replaceWith: "jay-son" },
  { find: "YAML", replaceWith: "yam-ul" },
  { find: "PostgreSQL", replaceWith: "post-gres Q L" },
  { find: "Linux", replaceWith: "lin-ucks" },
  { find: "TikTok", replaceWith: "tick tock" },
  { find: "LinkedIn", replaceWith: "linked in" },
  { find: "YouTube", replaceWith: "you tube" },
  { find: "WiFi", replaceWith: "why fy" },
];

/** All-capital words that are said as words, not spelled out. */
const SPOKEN_ACRONYMS = new Set([
  "NASA",
  "NATO",
  "UNESCO",
  "UNICEF",
  "LASER",
  "RADAR",
  "SCUBA",
  "OPEC",
  "FIFA",
  "WHO",
  "ASAP",
  "COVID",
  "AIDS",
  "GIF",
  "SQL",
  "JSON",
  "YAML",
]);

const LETTER_NAMES: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
  G: "G",
  H: "H",
  I: "I",
  J: "J",
  K: "K",
  L: "L",
  M: "M",
  N: "N",
  O: "O",
  P: "P",
  Q: "Q",
  R: "R",
  S: "S",
  T: "T",
  U: "U",
  V: "V",
  W: "W",
  X: "X",
  Y: "Y",
  Z: "Z",
};

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** A whole number from 0 to 999,999,999,999 in words. Larger values are left as digits. */
export function numberToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999_999_999_999)
    return String(value);
  if (value < 20) return ONES[value]!;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const rest = value % 10;
    return rest ? `${TENS[tens]} ${ONES[rest]}` : TENS[tens]!;
  }
  if (value < 1000) {
    const rest = value % 100;
    return `${ONES[Math.floor(value / 100)]} hundred${rest ? ` ${numberToWords(rest)}` : ""}`;
  }
  const scales: [number, string][] = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
  ];
  for (const [size, name] of scales) {
    if (value >= size) {
      const rest = value % size;
      return `${numberToWords(Math.floor(value / size))} ${name}${rest ? ` ${numberToWords(rest)}` : ""}`;
    }
  }
  return String(value);
}

/** 1 to 99 as an ordinal word: first, second, twenty first. */
function ordinalWords(value: number): string {
  const special: Record<number, string> = {
    1: "first",
    2: "second",
    3: "third",
    5: "fifth",
    8: "eighth",
    9: "ninth",
    12: "twelfth",
  };
  if (special[value]) return special[value]!;
  if (value < 20) return `${ONES[value]}th`;
  const tens = Math.floor(value / 10);
  const rest = value % 10;
  if (rest === 0) return `${TENS[tens]!.replace(/y$/, "ie")}th`;
  return `${TENS[tens]} ${ordinalWords(rest)}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const UNITS: Record<string, [string, string]> = {
  km: ["kilometer", "kilometers"],
  m: ["meter", "meters"],
  cm: ["centimeter", "centimeters"],
  mm: ["millimeter", "millimeters"],
  kg: ["kilogram", "kilograms"],
  g: ["gram", "grams"],
  mg: ["milligram", "milligrams"],
  lb: ["pound", "pounds"],
  lbs: ["pound", "pounds"],
  oz: ["ounce", "ounces"],
  mi: ["mile", "miles"],
  ft: ["foot", "feet"],
  l: ["liter", "liters"],
  ml: ["milliliter", "milliliters"],
  mph: ["mile per hour", "miles per hour"],
  kph: ["kilometer per hour", "kilometers per hour"],
  gb: ["gigabyte", "gigabytes"],
  mb: ["megabyte", "megabytes"],
  kb: ["kilobyte", "kilobytes"],
  tb: ["terabyte", "terabytes"],
  ghz: ["gigahertz", "gigahertz"],
  mhz: ["megahertz", "megahertz"],
  hz: ["hertz", "hertz"],
};

const CURRENCIES: Record<string, [string, string]> = {
  $: ["dollar", "dollars"],
  "€": ["euro", "euros"],
  "£": ["pound", "pounds"],
  "₹": ["rupee", "rupees"],
  "¥": ["yen", "yen"],
};

const SCALE_WORDS: Record<string, string> = {
  k: "thousand",
  K: "thousand",
  m: "million",
  M: "million",
  b: "billion",
  B: "billion",
  bn: "billion",
  t: "trillion",
  T: "trillion",
};

/** Speak a plain decimal such as 3.5 or 1200: "three point five", "twelve hundred" is avoided. */
function decimalWords(text: string): string {
  const [whole, fraction] = text.replace(/,/g, "").split(".");
  const wholeWords = numberToWords(Number(whole));
  if (!fraction) return wholeWords;
  return `${wholeWords} point ${[...fraction].map((d) => ONES[Number(d)]).join(" ")}`;
}

function removeEmoji(text: string): string {
  return text
    .replace(
      /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu,
      "",
    )
    .replace(/[ \t]{2,}/g, " ");
}

function speakUrlsAndHandles(text: string): string {
  return text
    .replace(/https?:\/\/(?:www\.)?([^\s/]+)(\/[^\s]*)?/gi, (_, host: string) =>
      host.replace(/\./g, " dot "),
    )
    .replace(
      /\b(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|app|ai|co|in|uk|edu|gov))\b(?:\/\S*)?/gi,
      (_, host: string) => host.replace(/\./g, " dot "),
    )
    .replace(/(^|\s)@([A-Za-z0-9_]{2,30})\b/g, "$1at $2")
    .replace(/(^|\s)#([A-Za-z][A-Za-z0-9_]{1,40})\b/g, "$1hashtag $2");
}

function speakDates(text: string): string {
  return text.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (whole, year: string, month: string, day: string) => {
      const m = Number(month);
      const d = Number(day);
      if (m < 1 || m > 12 || d < 1 || d > 31) return whole;
      return `${MONTHS[m - 1]} ${ordinalWords(d)}, ${year}`;
    },
  );
}

function speakMoney(text: string): string {
  return text.replace(
    /([$€£₹¥])\s?(\d[\d,]*(?:\.\d+)?)(bn|[kKmMbBtT])?\b/g,
    (_, symbol: string, amount: string, scale?: string) => {
      const [singular, plural] = CURRENCIES[symbol]!;
      const number = Number(amount.replace(/,/g, ""));
      const words = decimalWords(amount);
      const scaleWord = scale ? ` ${SCALE_WORDS[scale]}` : "";
      const one = !scale && number === 1;
      return `${words}${scaleWord} ${one ? singular : plural}`;
    },
  );
}

function speakPercents(text: string): string {
  return text.replace(
    /(\d[\d,]*(?:\.\d+)?)\s?%/g,
    (_, amount: string) => `${decimalWords(amount)} percent`,
  );
}

function speakOrdinals(text: string): string {
  return text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, (whole, n: string) => {
    const value = Number(n);
    return value >= 1 && value <= 99 ? ordinalWords(value) : whole;
  });
}

function speakUnits(text: string): string {
  return text.replace(
    /(\d[\d,]*(?:\.\d+)?)\s?(km|cm|mm|kg|mg|lbs|lb|oz|mi|ft|ml|mph|kph|gb|mb|kb|tb|ghz|mhz|hz|m|g|l)\b/gi,
    (whole, amount: string, unit: string) => {
      const entry = UNITS[unit.toLowerCase()];
      if (!entry) return whole;
      // "5 M" or "5 G" with a capital is more often a scale than a unit; leave it.
      if (/^[MGLB]$/.test(unit)) return whole;
      const number = Number(amount.replace(/,/g, ""));
      return `${decimalWords(amount)} ${number === 1 ? entry[0] : entry[1]}`;
    },
  );
}

function speakPlainNumbers(text: string): string {
  // Digits with thousands commas read as one number; years and short numbers stay.
  return text.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, (match) =>
    decimalWords(match),
  );
}

function spellAcronyms(text: string): string {
  return text.replace(/\b[A-Z]{2,6}s?\b/g, (word) => {
    const plural = word.endsWith("s") && word.length > 2;
    const core = plural ? word.slice(0, -1) : word;
    if (SPOKEN_ACRONYMS.has(core)) return word;
    // Roman numerals such as III or XIV are not acronyms.
    if (/^[IVXLCDM]+$/.test(core)) return word;
    const spelled = [...core].map((c) => LETTER_NAMES[c] ?? c).join(" ");
    return plural ? `${spelled}s` : spelled;
  });
}

function applyRules(text: string, rules: readonly PronunciationRule[]): string {
  // Longest phrase first so "PostgreSQL" wins over "SQL".
  const ordered = [...rules]
    .filter((rule) => rule.find.trim())
    .sort((a, b) => b.find.length - a.find.length);
  return ordered.reduce(
    (value, rule) =>
      value.replace(
        new RegExp(
          `(?<![\\p{L}\\p{N}])${rule.find.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
          "giu",
        ),
        () => rule.replaceWith,
      ),
    text,
  );
}

export interface NormalizeOptions {
  /** The person's own respellings; they win over the starter list. */
  dictionary?: readonly PronunciationRule[];
  /** Skip the bundled starter list. */
  noStarterList?: boolean;
}

/** What the voice is given for a line of narration. */
export function normalizeForSpeech(
  text: string,
  options: NormalizeOptions = {},
): string {
  const rules = [
    ...(options.dictionary ?? []),
    ...(options.noStarterList ? [] : STARTER_PRONUNCIATIONS),
  ];
  // The person's dictionary and the starter list run first, on the original
  // text, so a respelling is never rewritten by a later rule.
  let out = removeEmoji(text);
  out = applyRules(out, rules);
  out = speakUrlsAndHandles(out);
  out = speakDates(out);
  out = speakMoney(out);
  out = speakPercents(out);
  out = speakOrdinals(out);
  out = speakUnits(out);
  out = speakPlainNumbers(out);
  out = spellAcronyms(out);
  return out
    .replace(/&/g, " and ")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Characters a voice cannot say. Used by the storyboard linter to warn. */
export function unspeakableCharacters(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(
    /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]|[→←↑↓⇒⇐✓✔✗✘•▪■□◆◇★☆©®™§¶†‡]/gu,
  ))
    found.add(match[0]);
  return [...found];
}

/** Parse "word = how it sounds" lines (one per line; "#" starts a comment). */
export function parseDictionary(source: string): PronunciationRule[] {
  const rules: PronunciationRule[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const find = line.slice(0, at).trim();
    const replaceWith = line.slice(at + 1).trim();
    if (find && replaceWith && find.length <= 60 && replaceWith.length <= 120)
      rules.push({ find, replaceWith });
  }
  return rules.slice(0, 500);
}

export function formatDictionary(rules: readonly PronunciationRule[]): string {
  return rules.map((rule) => `${rule.find} = ${rule.replaceWith}`).join("\n");
}
