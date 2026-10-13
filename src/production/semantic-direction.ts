import {
  semanticGraphicSchema,
  type SemanticGraphic,
} from "@/video/semantic-graphic";
import type { ShotDirection } from "@/video/shot-direction";
import { chooseShowpiece, showpieceCompatible } from "./showpiece-plan";

const SYMBOL_WORDS: Record<SemanticGraphic["nodes"][number]["symbol"], RegExp> =
  {
    agent: /\b(agents?|bots?|robots?|automation)\b/i,
    cloud: /\b(cloud|server|servers|hosting|vm|network|cdn)\b/i,
    device: /\b(phone|device|laptop|screen|wireframe|prototype|app)\b/i,
    search:
      /\b(search|searches|rank|ranking|find|found|discover|discovery|seo)\b/i,
    answer: /\b(answer|answers|question|questions|response|responses|aeo)\b/i,
    sources:
      /\b(source|sources|synthesis|synthesi[sz]e|generative|citations?|evidence)\b/i,
    document:
      /\b(document|documents|article|articles|notes|script|scripts|content|page|pages|brief|website)\b/i,
    code: /\b(code|coding|api|program|software|developer|database)\b/i,
    person:
      /\b(person|people|audience|customer|customers|user|users|team|teams|ceo|cto|coo|cmo|cxo|designer|reviewer|tester|devops|engineer|manager)\b/i,
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
  if (graphic.presentation && !showpieceCompatible(graphic))
    return "This showpiece does not match the supplied visual structure.";
  if (graphic.relationship && graphic.presentation)
    return "Shared-region diagrams keep their overlap layout.";
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
  if (
    graphic.kind === "hierarchy" &&
    !/\b(hires?|leads?|manages?|oversees?|supported by|reports?|teams?|hierarchy|branches?)\b/i.test(
      copy,
    )
  )
    return "A hierarchy needs an explicit organisation in the copy.";
  if (
    graphic.kind === "system" &&
    !/\b(connect(?:s|ing)?|routes?|links?|feeds?|through|architecture)\b/i.test(
      copy,
    )
  )
    return "A system needs an explicit connection in the copy.";
  if (
    graphic.presentation === "device-evolution" &&
    !/\b(app|phone|device|screen|wireframe|prototype|design)\b/i.test(copy)
  )
    return "Product evolution needs a supplied product or device story.";
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
  if (graphic.kind === "hierarchy") {
    const depths: number[] = [];
    const literal = (label: string) =>
      `(?:^|[^\\p{L}\\p{N}])${normalize(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`;
    for (let index = 0; index < graphic.nodes.length; index++) {
      const node = graphic.nodes[index];
      if (index === 0) {
        depths.push(0);
        continue;
      }
      const parentIndex = node.parent ?? 0;
      depths.push(depths[parentIndex] + 1);
      if (depths[index] > 2)
        return "Group a deep organisation into readable scenes with at most three levels.";
      const parent = graphic.nodes[parentIndex];
      const forward = new RegExp(
        `${literal(parent.label)}[^.!?;]{0,120}\\b(?:hires?|leads?|manages?|oversees?|supported by)\\b[^.!?;]{0,180}${literal(node.label)}`,
        "u",
      );
      const reverse = new RegExp(
        `${literal(node.label)}[^.!?;]{0,120}\\breports? to\\b[^.!?;]{0,120}${literal(parent.label)}`,
        "u",
      );
      if (!forward.test(copy) && !reverse.test(copy))
        return "Each hierarchy branch needs its supplied parent-child relationship.";
    }
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
    graphic.nodes.some((node) =>
      /\b(?:and\s+)?(?:then|finally)$|[,;:]$/i.test(node.label),
    )
  )
    return "Process labels describe the step, not a trailing narration connector.";
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
  const ordered = /\bfirst\b/i.test(copy)
    ? copy.replace(/^First\s+/i, "").split(/\s*[,;]?\s+\b(?:then|finally)\s+/i)
    : /\b(app|phone|device|product)\b/i.test(copy) && /\bfrom\b/i.test(copy)
      ? copy
          .split(/\bfrom\s+/i)
          .at(-1)!
          .split(/\s+(?:and\s+)?(?:finally\s+)?to\s+/i)
      : [];
  if (ordered.length >= 2 && ordered.length <= 6) {
    const labels = ordered.map((label) =>
      label
        .replace(/[.!;,]$/, "")
        .trim()
        .replace(/^(?:a|an|the|your)\s+/i, ""),
    );
    const graphic: SemanticGraphic = {
      version: 1,
      kind: "flow",
      nodes: labels.map((label) => ({
        label,
        symbol: symbolForContent(label),
      })),
    };
    if (!semanticGraphicIssue(graphic, text, spokenText)) return graphic;
  }
  const naturalStructure =
    /^(?:an?|the|your)\s+(.{2,32}?)\s+(?:acts as [^,]{1,60},\s+)?(connecting)\s+(.+?)[.!]?$/i.exec(
      copy,
    ) ??
    /^(?:an?|the|your)?\s*(.{2,32}?)\s+[^.!?]{0,80}?\b(supported by|oversees)\s+(.+?)[.!]?$/i.exec(
      copy,
    );
  const structure =
    naturalStructure ??
    /^(.{2,40}?)\s+(hires?|leads?|manages?|connects?|routes?|links?)\s+(.+?)[.!]?$/i.exec(
      copy,
    );
  if (structure) {
    const children = structure[3]
      .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
      .map((label) => label.trim().replace(/^(?:a|an|the|your)\s+/i, ""))
      .filter(Boolean);
    if (
      children.length >= 2 &&
      children.length <= 7 &&
      children.every((label) => label.length <= 32)
    ) {
      const kind = /^(hire|lead|manage|oversee|supported)/i.test(structure[2])
        ? "hierarchy"
        : "system";
      const root = structure[1].replace(/^(?:a|an|the|your)\s+/i, "");
      const graphic: SemanticGraphic = {
        version: 1,
        kind,
        nodes: [root, ...children].map((label, index) => ({
          label,
          symbol: symbolForContent(label),
          ...(kind === "hierarchy" && index ? { parent: 0 } : {}),
        })),
      };
      if (!semanticGraphicIssue(graphic, text, spokenText)) return graphic;
    }
  }
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
    const structured = inferSemanticGraphic(text, scene.spokenText);
    if (
      !graphic &&
      structured &&
      ["hierarchy", "system"].includes(structured.kind) &&
      (!scene.direction?.graphic || scene.direction.graphic.kind === "concept")
    )
      graphic = structured;
    graphic ??=
      resolveSemanticGraphic(scene, source) ??
      inferSemanticGraphic(text, scene.spokenText);
    if (
      !graphic ||
      semanticGraphicIssue(graphic, text, scene.spokenText, source)
    )
      return scene;
    // Freeze a multi-phase showpiece on new drafts or an explicit replan.
    // Older saved illustrations remain unchanged until this pass is requested.
    if (!graphic.relationship)
      graphic = {
        ...graphic,
        presentation:
          graphic.presentation ??
          chooseShowpiece(graphic, `${text} ${scene.spokenText ?? ""}`),
      };
    const direction = {
      version: 1 as const,
      role:
        graphic.kind === "comparison"
          ? ("comparison" as const)
          : ["flow", "hierarchy", "system"].includes(graphic.kind)
            ? ("diagram" as const)
            : (scene.direction?.role ?? ("explanation" as const)),
      composition: "authored" as const,
      graphic,
    };
    return { ...scene, direction };
  });
}
