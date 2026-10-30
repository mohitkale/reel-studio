import type { StockMediaCandidate } from "@/providers/stock/schemas";
import { dimsFor, type Orientation } from "@/lib/orientation";
import type {
  MediaSelectionRanking,
  MediaVisionAssessment,
} from "./media-ranking-contract";
const STOP = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
  "your",
  "you",
  "video",
  "photo",
  "image",
]);
const tokens = (value: string) =>
  [
    ...new Set(
      value
        .normalize("NFKC")
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ].filter((t) => t.length > 1 && !STOP.has(t));
export const stockCandidateKey = (
  candidate: Pick<StockMediaCandidate, "providerId" | "providerAssetId">,
) => `${candidate.providerId}:${candidate.providerAssetId}`;
function slug(candidate: StockMediaCandidate) {
  try {
    return decodeURIComponent(
      new URL(candidate.sourcePageUrl).pathname,
    ).replace(/\d+/g, " ");
  } catch {
    return "";
  }
}
export function stockPreviewKey(candidate: StockMediaCandidate) {
  try {
    const url = new URL(candidate.previewUrl);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return candidate.previewUrl;
  }
}
const STYLE_WORDS = new Set([
  "calm",
  "minimal",
  "warm",
  "cool",
  "blue",
  "green",
  "red",
  "neon",
  "cinematic",
  "studio",
  "night",
  "daylight",
  "office",
  "nature",
  "urban",
  "abstract",
  "illustration",
  "photograph",
  "monochrome",
]);
export function candidateStyleTags(candidate: StockMediaCandidate) {
  return (
    candidate.styleTags ??
    tokens([candidate.description ?? "", ...(candidate.tags ?? [])].join(" "))
      .filter((word) => STYLE_WORDS.has(word))
      .slice(0, 8)
  );
}
/** Metadata is evidence about a candidate, not pixel-level verification. Unknowns stay neutral and visible. */
export function rankStockCandidates(
  candidates: StockMediaCandidate[],
  context: {
    query: string;
    orientation: Orientation;
    sceneText?: string;
    usedKeys?: readonly string[];
    filmStyleTags?: readonly string[];
    vision?: readonly MediaVisionAssessment[];
  },
) {
  const target = dimsFor(context.orientation),
    aspect = target.width / target.height,
    words = tokens(context.query + " " + (context.sceneText ?? ""));
  const used = new Set(context.usedKeys ?? []),
    seen = new Set<string>();
  return candidates
    .map((candidate) => {
      const key = stockCandidateKey(candidate),
        preview = stockPreviewKey(candidate),
        vision = context.vision?.find((v) => v.candidateId === key);
      const metadata = tokens(
        [
          candidate.description ?? "",
          ...(candidate.tags ?? []),
          slug(candidate),
        ].join(" "),
      );
      const overlap = words.length
        ? words.filter((w) => metadata.includes(w)).length / words.length
        : 0;
      const relevance = vision
        ? overlap * 0.35 + vision.relevance * 0.65
        : metadata.length
          ? overlap
          : 0.25;
      const ratio = candidate.width / candidate.height,
        crop = Math.min(aspect / ratio, ratio / aspect);
      const resolution = Math.max(
        ...candidate.renderRenditions.map((r) =>
          Math.min(1, r.width / target.width, r.height / target.height),
        ),
      );
      const textSpace = vision?.textSpace ?? 0.5;
      const styleTags = vision?.styleTags ?? candidateStyleTags(candidate);
      const consistency =
        context.filmStyleTags?.length && styleTags.length
          ? styleTags.filter((t) => context.filmStyleTags!.includes(t)).length /
            styleTags.length
          : 0.5;
      const duplicate =
        used.has(key) ||
        used.has(preview) ||
        seen.has(key) ||
        seen.has(preview);
      seen.add(key);
      seen.add(preview);
      const components = {
        relevance,
        crop,
        resolution,
        textSpace,
        consistency,
        duplicate,
      };
      const score =
        Math.round(
          (relevance * 50 +
            crop * 20 +
            resolution * 15 +
            textSpace * 8 +
            consistency * 7 -
            (duplicate ? 65 : 0)) *
            100,
        ) / 100;
      const reasons = [
        metadata.length
          ? `${Math.round(overlap * 100)}% subject-term overlap from provider description/tags/source slug`
          : "Subject metadata unavailable; relevance is uncertain",
        `${Math.round(crop * 100)}% area retained by a centered ${context.orientation} crop`,
        resolution >= 1
          ? "Rendition can cover the target resolution"
          : "Rendition may require upscaling",
        vision
          ? `Vision estimate: ${vision.reason}`
          : "Text space unknown; inspect the preview before placing copy",
        duplicate
          ? "Already used or duplicated in this film"
          : "No exact duplicate detected",
        consistency !== 0.5
          ? "Style tags compared with earlier film selections"
          : "No reliable film style comparison available",
      ];
      return {
        candidate,
        summary: {
          providerId: candidate.providerId,
          providerAssetId: candidate.providerAssetId,
          score,
          components,
          reasons,
        },
        styleTags,
      };
    })
    .sort(
      (a, b) =>
        b.summary.score - a.summary.score ||
        stockCandidateKey(a.candidate).localeCompare(
          stockCandidateKey(b.candidate),
          "en",
        ),
    );
}
export function selectionRanking(
  ranked: ReturnType<typeof rankStockCandidates>,
  index: number,
  query: string,
  hasVision = false,
): MediaSelectionRanking {
  return {
    version: 1,
    method: hasVision ? "metadata+vision" : "metadata",
    query: query.slice(0, 1000),
    selected: ranked[index].summary,
    alternatives: ranked
      .filter((_, i) => i !== index)
      .slice(0, 5)
      .map((item) => item.summary),
  };
}
