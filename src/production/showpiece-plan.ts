import type { SemanticGraphic, ShowpieceId } from "@/video/semantic-graphic";
import type { SpokenWordWindow } from "@/lib/spoken-word-windows";

export function chooseShowpiece(
  graphic: SemanticGraphic,
  copy: string,
): ShowpieceId {
  if (graphic.kind === "hierarchy") return "branch-cascade";
  if (graphic.kind === "system") return "signal-routing";
  if (graphic.kind === "comparison") return "orbital-comparison";
  if (graphic.kind === "flow")
    return /\b(app|phone|device|screen|wireframe|prototype)\b/i.test(copy)
      ? "device-evolution"
      : "kinetic-handoff";
  return "depth-focus";
}
export function showpieceCompatible(graphic: SemanticGraphic): boolean {
  return (
    !graphic.presentation ||
    (
      {
        "depth-focus": ["concept"],
        "orbital-comparison": ["comparison"],
        "branch-cascade": ["hierarchy"],
        "signal-routing": ["system"],
        "kinetic-handoff": ["flow"],
        "device-evolution": ["flow"],
      }[graphic.presentation] as readonly string[]
    ).includes(graphic.kind)
  );
}
const clean = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** Narration-relative landmarks shared by picture and sound. Measured words win;
 * otherwise use a disclosed estimated schedule across the full beat. */
export function showpieceSchedule(
  graphic: SemanticGraphic,
  duration: number,
  fps: number,
  startFrame = 0,
  words: readonly (SpokenWordWindow & { text?: string })[] = [],
) {
  const end = Math.max(0.6, duration - 0.8);
  const arrivals = graphic.nodes.map((node, index) => {
    const tokens = node.label.split(/\s+/).map(clean);
    const candidates = words.filter(
      (word) =>
        word.startFrame >= startFrame &&
        word.startFrame < startFrame + duration * fps,
    );
    const at = candidates.findIndex((word, i) =>
      tokens.every(
        (token, j) => clean(candidates[i + j]?.text ?? "") === token,
      ),
    );
    const measured =
      at >= 0 ? (candidates[at].startFrame - startFrame) / fps : undefined;
    const estimate =
      graphic.nodes.length === 1
        ? 0.5
        : 0.45 + index * Math.max(0.45, (end - 1) / graphic.nodes.length);
    return Math.min(end - 0.2, Math.max(0.12, measured ?? estimate));
  });
  // Parent/owner cannot arrive after its child. A final leg leaves reading time.
  for (let i = 1; i < arrivals.length; i++)
    arrivals[i] = Math.min(
      end - 0.2,
      Math.max(arrivals[i - 1] + 0.3, arrivals[i]),
    );
  return {
    arrivals,
    resolve: Math.min(duration - 0.25, Math.max(...arrivals) + 0.65),
    end,
  };
}
/** Same literal subject keeps its accent lane in every scene. */
export function subjectLane(label: string): number {
  return (
    Array.from(clean(label)).reduce(
      (hash, c) => (hash * 31 + c.codePointAt(0)!) >>> 0,
      0,
    ) % 3
  );
}
