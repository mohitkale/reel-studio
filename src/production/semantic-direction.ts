import {
  semanticGraphicSchema,
  type SemanticGraphic,
} from "@/video/semantic-graphic";
import type { ShotDirection } from "@/video/shot-direction";

const SYMBOL_WORDS: Record<SemanticGraphic["nodes"][number]["symbol"], RegExp> =
  {
    search:
      /\b(search|searches|rank|ranking|find|found|discover|discovery|seo)\b/i,
    answer: /\b(answer|answers|question|questions|response|responses|aeo)\b/i,
    sources:
      /\b(source|sources|synthesis|synthesi[sz]e|generative|citations?|evidence)\b/i,
    document:
      /\b(document|documents|article|articles|notes|script|scripts|content|page|pages|brief)\b/i,
    code: /\b(code|coding|api|program|software|developer|database)\b/i,
    person:
      /\b(person|people|audience|customer|customers|user|users|team|teams)\b/i,
    growth: /\b(plant|plants|grow|growth|garden|gardening|seed|seeds)\b/i,
    target: /\b(goal|goals|target|focus|objective|objectives)\b/i,
    shield: /\b(safe|safety|protect|protection|security|secure|privacy)\b/i,
    clock:
      /\b(time|timing|schedule|scheduling|minute|minutes|hour|hours|deadline)\b/i,
    idea: /\b(idea|ideas|learn|learning|understand|insight|concept|concepts)\b/i,
    media: /\b(media|video|videos|image|images|audio|film|films)\b/i,
    none: /(?:)/,
  };
const normalize = (text: string) =>
  text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Avoid printing an explanatory sentence again when the headline already contains it. */
export function semanticGraphicCaptions(
  text: string,
  graphic: SemanticGraphic,
): SemanticGraphic["nodes"] {
  return graphic.nodes.map((node) => ({
    ...node,
    detail:
      node.detail && !normalize(text).includes(normalize(node.detail))
        ? node.detail
        : undefined,
  }));
}

export function symbolForContent(
  text: string,
): SemanticGraphic["nodes"][number]["symbol"] {
  if (/\b(generative|synthesis|synthesi[sz]e|citations?)\b/i.test(text))
    return "sources";
  for (const [symbol, words] of Object.entries(SYMBOL_WORDS))
    if (symbol !== "none" && words.test(text))
      return symbol as SemanticGraphic["nodes"][number]["symbol"];
  return "none";
}

/** Revalidate against current copy on every build. Stale or invented labels cannot render. */
export function semanticGraphicIssue(
  graphic: SemanticGraphic,
  text: string,
  spokenText?: string,
  storySource?: string,
): string | undefined {
  if (!semanticGraphicSchema.safeParse(graphic).success)
    return "The visual structure is invalid.";
  const copy = normalize(`${text} ${spokenText ?? ""}`);
  if (graphic.kind === "concept" && graphic.nodes[0].symbol === "none")
    return "A concept illustration needs a supported semantic subject.";
  if (
    graphic.relationship &&
    (graphic.kind !== "comparison" ||
      graphic.nodes.length > 3 ||
      graphic.nodes.some((node) => node.detail) ||
      !/\b(overlap|overlapping|intersect|intersection|share|shared|common)\b/i.test(
        copy,
      ))
  )
    return "Overlap diagrams need two or three short subjects and an explicit shared relationship.";
  const contains = (fragment: string) =>
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${normalize(fragment).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`,
      "u",
    ).test(copy);
  if (Array.from(text).length > 240)
    return "Shorten this scene to 240 characters for an illustrated layout.";
  if (
    graphic.nodes.reduce(
      (sum, node) => sum + Array.from(node.label + (node.detail ?? "")).length,
      0,
    ) > 240
  )
    return "Use shorter illustration labels and details for a readable scene.";
  for (const node of graphic.nodes) {
    if (!contains(node.label) || (node.detail && !contains(node.detail)))
      return "The illustration labels must appear in the current scene copy or narration.";
    const quoted =
      node.sourceQuote &&
      storySource &&
      normalize(storySource).includes(normalize(node.sourceQuote)) &&
      normalize(node.sourceQuote).includes(normalize(node.label));
    if (node.sourceQuote && !quoted)
      return "The referenced subject definition no longer appears in this story.";
    if (
      node.symbol !== "none" &&
      !SYMBOL_WORDS[node.symbol].test(
        `${node.label} ${node.detail ?? ""} ${quoted ? node.sourceQuote : ""}`,
      )
    )
      return "Choose a symbol that matches its supplied subject.";
  }
  if (
    new Set(graphic.nodes.map((node) => normalize(node.label))).size !==
    graphic.nodes.length
  )
    return "Each illustration subject needs a distinct supplied label.";
  if (
    graphic.kind === "comparison" &&
    !/(?:\bvs\.?\b|\bversus\b|\bcompar|\bdiffer|\bwhereas\b|\bboth\b|\brather\b|[,;])/i.test(
      copy,
    )
  )
    return "A comparison needs an explicit comparison or named alternatives.";
  if (
    graphic.kind === "flow" &&
    !/\b(then|first|next|finally|step|steps|from|into|becomes|through|feeds|follow|process|before|after)\b|→/i.test(
      copy,
    )
  )
    return "A flow needs an explicit order or relationship in the supplied copy.";
  if (
    graphic.kind === "flow" &&
    ![text, spokenText ?? ""].some((source) => {
      let at = 0;
      return graphic.nodes.every((node) => {
        const found = normalize(source).indexOf(normalize(node.label), at);
        if (found < 0) return false;
        at = found + normalize(node.label).length;
        return true;
      });
    })
  )
    return "Keep process subjects in their supplied order.";
  return undefined;
}

/** Conservative local fallback: illustrate explicit definitions and comparisons,
 * never a generic sentence by hashing its position into a theme. */
export function inferSemanticGraphic(
  text: string,
  spokenText?: string,
): SemanticGraphic | undefined {
  const copy = (spokenText ?? text).trim();
  const namedDefinition =
    /^([\p{L}\p{N}][\p{L}\p{N} -]{1,31}),\s*(?:or\s+)?([^,]{3,96}),\s*/u.exec(
      copy,
    );
  if (namedDefinition) {
    const label = namedDefinition[1];
    const detail = namedDefinition[2];
    const symbol = symbolForContent(detail);
    const graphic: SemanticGraphic = {
      version: 1,
      kind: "concept",
      nodes: [{ label, detail, symbol }],
    };
    if (symbol !== "none" && !semanticGraphicIssue(graphic, text, spokenText))
      return graphic;
  }
  const alternatives = copy
    .replace(/[.!?]$/, " ")
    .split(/\s+(?:vs\.?|versus)\s+/i)
    .map((part) => part.trim());
  if (
    alternatives.length >= 2 &&
    alternatives.length <= 4 &&
    alternatives.every((part) => part.length <= 48)
  ) {
    const graphic: SemanticGraphic = {
      version: 1,
      kind: "comparison",
      nodes: alternatives.map((label) => ({
        label,
        symbol: symbolForContent(label),
      })),
    };
    if (!semanticGraphicIssue(graphic, text, spokenText)) return graphic;
  }
  const definition =
    /^(.{2,48}?)\s+(is|are|means?|helps?|uses?|protects?|turns?|connects?|supports?|makes?|needs?)\s+(.{3,88}?)[.!?]?$/i.exec(
      copy,
    );
  if (
    !definition ||
    /^(you|your|it|this|that|these|they|we|our|each|everything|think)\b/i.test(
      definition[1],
    )
  )
    return undefined;
  const label = definition[1]
    .split(/,\s*(?:or\s+)?/i)[0]
    .trim()
    .replace(/^(?:a|an|the)\s+/i, "");
  if (
    /[.!?:;]/.test(label) ||
    /\b(what|why|how|which|who|when)\b/i.test(label) ||
    label.split(/\s+/).length > 5
  )
    return undefined;
  const detail = `${definition[2]} ${definition[3]}`;
  const symbol = symbolForContent(`${label} ${detail}`);
  if (symbol === "none") return undefined;
  const graphic: SemanticGraphic = {
    version: 1,
    kind: "concept",
    nodes: [{ label, detail, symbol }],
  };
  return semanticGraphicIssue(graphic, text, spokenText) ? undefined : graphic;
}

export function resolveSemanticGraphic(
  scene: {
    text: string;
    spokenText?: string;
    visual?: string;
    items?: string[];
    chart?: unknown;
    background?: { url: string };
    hideText?: boolean | null;
    hasVisualContent?: boolean;
    direction?: { graphic?: SemanticGraphic };
  },
  storySource?: string,
): SemanticGraphic | undefined {
  const graphic = scene.direction?.graphic;
  if (
    !graphic ||
    scene.hideText ||
    scene.visual ||
    scene.hasVisualContent ||
    scene.items?.length ||
    scene.chart ||
    scene.background?.url
  )
    return undefined;
  return semanticGraphicIssue(
    graphic,
    scene.text,
    scene.spokenText,
    storySource,
  )
    ? undefined
    : graphic;
}

type StoryScene = Omit<
  Parameters<typeof resolveSemanticGraphic>[0],
  "direction"
> & { direction?: ShotDirection; locks?: { scene?: boolean } };
export function semanticStorySource(
  scenes: readonly { text: string; spokenText?: string | null }[],
): string {
  return scenes
    .map((scene) => `${scene.text} ${scene.spokenText ?? ""}`)
    .join("\n");
}

/** Reuse definitions across the story. A comparison overview preserves the
 * order of its named subjects; it cannot be reduced to one decorative icon. */
export function enrichSemanticSequence<T extends StoryScene>(
  scenes: readonly T[],
  storyScenes: readonly StoryScene[] = scenes,
): T[] {
  const source = semanticStorySource(storyScenes);
  const subjects = new Map<
    string,
    {
      label: string;
      symbol: SemanticGraphic["nodes"][number]["symbol"];
      quote: string;
    }
  >();
  for (const scene of storyScenes) {
    const graphic =
      resolveSemanticGraphic(scene, source) ??
      inferSemanticGraphic(scene.text, scene.spokenText);
    if (graphic?.kind !== "concept") continue;
    const node = graphic.nodes[0];
    const fullQuote = `${scene.text} ${scene.spokenText ?? ""}`.trim();
    const quote =
      fullQuote.length <= 240
        ? fullQuote
        : fullQuote.slice(0, 240).replace(/\s+\S*$/u, "");
    if (
      quote.length <= 240 &&
      node.label.split(/\s+/).length <= 5 &&
      !/[.!?:;]/.test(node.label)
    )
      subjects.set(normalize(node.label), {
        label: node.label,
        symbol: node.symbol,
        quote,
      });
  }
  return scenes.map((scene) => {
    if (
      scene.locks?.scene ||
      scene.hideText ||
      scene.visual ||
      scene.hasVisualContent ||
      scene.background?.url ||
      scene.chart ||
      scene.items?.length
    )
      return scene;
    const text = scene.text;
    const mentioned = [...subjects.values()]
      .flatMap((subject) => {
        const literal = subject.label
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\s+/g, "\\s+");
        const match = new RegExp(
          `(?<![\\p{L}\\p{N}])${literal}(?=$|[^\\p{L}\\p{N}])`,
          "iu",
        ).exec(text);
        return match ? [{ ...subject, label: match[0], at: match.index }] : [];
      })
      .sort((a, b) => a.at - b.at);
    let graphic: SemanticGraphic | undefined;
    if (
      mentioned.length >= 2 &&
      mentioned.length <= 4 &&
      /[,;]|\b(vs|versus|different|compare|comparison)\b/i.test(text)
    )
      graphic = {
        version: 1,
        kind: "comparison",
        nodes: mentioned.map((subject) => ({
          label: subject.label,
          symbol: subject.symbol,
          sourceQuote: subject.quote,
        })),
      };
    if (
      graphic?.kind === "comparison" &&
      graphic.nodes.length <= 3 &&
      /\b(overlap|overlapping|intersect|intersection|share|shared|common)\b/i.test(
        `${text} ${scene.spokenText ?? ""}`,
      )
    )
      graphic.relationship = "overlap";
    graphic ??=
      resolveSemanticGraphic(scene, source) ??
      inferSemanticGraphic(text, scene.spokenText);
    if (
      !graphic ||
      semanticGraphicIssue(graphic, text, scene.spokenText, source)
    )
      return scene;
    const direction = {
      version: 1 as const,
      role:
        graphic.kind === "comparison"
          ? ("comparison" as const)
          : graphic.kind === "flow"
            ? ("diagram" as const)
            : (scene.direction?.role ?? ("explanation" as const)),
      composition: "authored" as const,
      graphic,
    };
    return { ...scene, direction };
  });
}
