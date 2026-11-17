import type { SceneDTO } from "@/lib/dto";

/** What the undo endpoint needs to put a scene back exactly as it was. */
export interface UndoScene {
  id: string;
  templateId: string | null;
  text: string;
  spokenText: string | null;
  emphasis: string[];
  visual: string | null;
  background?: SceneDTO["background"];
  items?: string[];
  chart?: SceneDTO["chart"];
  mood?: string;
  musicMood?: string;
  role?: SceneDTO["role"];
  motion?: SceneDTO["motion"];
  direction?: SceneDTO["direction"];
  assetRefs?: string[];
  locks?: SceneDTO["locks"];
  hideText?: boolean | null;
  selectedVoiceClipId?: string | null;
}

/** Copy a scene into the undo payload, so a snapshot cannot change under us. */
export function toUndoScene(scene: SceneDTO): UndoScene {
  return structuredClone({
    id: scene.id,
    templateId: scene.templateId,
    text: scene.text,
    spokenText: scene.spokenText,
    emphasis: scene.emphasis,
    visual: scene.visual ?? null,
    background: scene.background,
    items: scene.items,
    chart: scene.chart,
    mood: scene.mood,
    musicMood: scene.musicMood,
    role: scene.role,
    motion: scene.motion,
    direction: scene.direction,
    assetRefs: scene.assetRefs,
    locks: scene.locks,
    hideText: scene.hideText,
    selectedVoiceClipId: scene.selectedVoiceClipId,
  });
}

/** True when the scenes differ from the snapshot in text, narration or order. */
export function sceneStripChanged(
  snapshot: UndoScene[],
  scenes: Pick<SceneDTO, "id" | "text" | "spokenText">[],
): boolean {
  if (snapshot.length !== scenes.length) return true;
  return scenes.some((scene, i) => {
    const before = snapshot[i];
    return (
      before.id !== scene.id ||
      before.text !== scene.text ||
      (before.spokenText ?? "") !== (scene.spokenText ?? "")
    );
  });
}

/** Swap a scene with its neighbour. Returns the ids in the new order. */
export function moveScene(ids: string[], index: number, by: -1 | 1): string[] {
  const target = index + by;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length)
    return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
