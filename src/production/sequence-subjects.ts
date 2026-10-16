import {
  subjectKey,
  subjectRegistrySchema,
  type Subject,
} from "@/video/sequence-direction";
import type { ShotDirection } from "@/video/shot-direction";

type SubjectScene = { items?: string[]; direction?: ShotDirection };
/** A stale explanation must never masquerade as a decision about edited copy. */
export function sequenceSourceKey(scene: {
  text: string;
  role?: string;
  items?: string[];
  chart?: unknown;
  background?: unknown;
  hasVisualContent?: boolean;
}) {
  return stableSubjectHash(
    JSON.stringify({
      text: scene.text,
      role: scene.role,
      items: scene.items?.length ? scene.items : undefined,
      chart: scene.chart,
      background: scene.background,
      visual: Boolean(scene.hasVisualContent),
    }),
  ).toString(36);
}
export function stableSubjectHash(text: string): number {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.codePointAt(0)!, 16777619);
  return n >>> 0;
}
/** Only literal equality or configured aliases establish identity. No fuzzy/LLM merging. */
export function collectSequenceSubjects(
  scenes: readonly SubjectScene[],
  saved: Subject[] = [],
): Subject[] {
  const subjects = subjectRegistrySchema
    .parse(saved)
    .map((s) => ({ ...s, aliases: [...s.aliases] }));
  const labels = new Set(
    subjects.flatMap((s) => [s.label, ...s.aliases].map(subjectKey)),
  );
  const ids = new Set(subjects.map((s) => s.id));
  const incoming = scenes
    .flatMap((scene) => [
      ...(scene.items ?? []).map((label) => ({
        label,
        symbol: "none" as const,
      })),
      ...(scene.direction?.graphic?.nodes ?? []).map(({ label, symbol }) => ({
        label,
        symbol,
      })),
    ])
    .filter((s) => s.label.trim() && Array.from(s.label).length <= 96)
    .sort((a, b) =>
      subjectKey(a.label) < subjectKey(b.label)
        ? -1
        : subjectKey(a.label) > subjectKey(b.label)
          ? 1
          : 0,
    );
  for (const { label, symbol } of incoming) {
    const key = subjectKey(label);
    if (labels.has(key)) continue;
    const hash = stableSubjectHash(key),
      base = `subject-${hash.toString(36)}-${stableSubjectHash(Array.from(key).reverse().join("")).toString(36)}`;
    let id = base,
      index = 1;
    while (ids.has(id)) id = `${base}-${index++}`;
    subjects.push({
      id,
      label: key,
      aliases: [],
      symbol,
      colorSlot: (["accent", "accentSecondary", "foreground"] as const)[
        hash % 3
      ],
    });
    ids.add(id);
    labels.add(key);
  }
  return subjectRegistrySchema.parse(subjects);
}
export function findSequenceSubject(
  subjects: readonly Subject[],
  label: string,
) {
  const key = subjectKey(label);
  return subjects.find((s) =>
    [s.label, ...s.aliases].some((alias) => subjectKey(alias) === key),
  );
}
