import type { EvidencePack } from "./contracts";
import type { ScenePlan } from "@/providers/ai/types";

/** Exclude disputed excerpts from deterministic numeric admission. */
export function creationEvidenceSources(evidence: EvidencePack): string[] {
  const disputed = new Set(evidence.conflicts.flatMap((item) => item.claimIds));
  const excerpts = new Set(
    evidence.claims
      .filter((item) => disputed.has(item.id))
      .flatMap((item) => item.references.map((ref) => ref.excerptId)),
  );
  return evidence.sources.flatMap((source) =>
    source.excerpts
      .filter((excerpt) => !excerpts.has(excerpt.id))
      .map((excerpt) => excerpt.text),
  );
}

/** Detect unsupported numeric tokens; this is not semantic fact checking. */
export function unsupportedCreationNumbers(
  plan: ScenePlan,
  sources: string[],
): string[] {
  const tokens = (text: string) =>
    text.match(/\b\d+(?:[.,]\d+)*(?:\s*%|\b)/g) ?? [];
  const normalize = (token: string) => token.replace(/\s/g, "").toLowerCase();
  const allowed = new Set(sources.flatMap(tokens).map(normalize));
  return [
    ...new Set(
      plan.scenes
        .flatMap((scene) => tokens(`${scene.text}\n${scene.spokenText ?? ""}`))
        .filter((token) => !allowed.has(normalize(token))),
    ),
  ];
}
