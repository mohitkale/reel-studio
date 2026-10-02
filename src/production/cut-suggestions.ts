import { z } from "zod";
import type { ScriptDTO, VoiceTakeDTO } from "@/lib/dto";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { resolveSpokenWordWindows } from "@/lib/spoken-word-windows";
import { coverFrames } from "@/video/types";
import { musicBeatAnchors, musicMapSchema } from "@/production/music-map";

export const cutSuggestionRequestSchema = z
  .object({
    takeId: z.string().min(1),
    reviewed: z.literal(true),
    expectedMusicMap: musicMapSchema,
  })
  .strict();

export interface CutSuggestion {
  sceneId: string;
  fromFrame: number;
  toFrame: number;
  anchor: "beat" | "drop";
}

/** Advisory only: neither the take nor creator timing is ever retimed. */
export function suggestNarrationCuts(script: ScriptDTO, take: VoiceTakeDTO) {
  const fps = take.fps;
  const resolved = resolveReelTimeline(
    script.scenes.map((scene) => ({
      id: scene.id,
      text: resolveSpokenText(scene),
    })),
    take,
    fps,
  );
  const empty = (reason: string) => ({
    fps,
    suggestions: [] as CutSuggestion[],
    reason,
  });
  if (!resolved.takeUsable || take.isPlaceholder)
    return empty("Choose a matching recorded voice take.");
  const map = script.musicMap;
  if (!map || map.sourceUrl !== script.musicUrl)
    return empty("Review the selected music track first.");
  const words = resolveSpokenWordWindows(script.captionTracks, take.id, fps);
  if (!words.length)
    return empty("Generate measured word timing for this take first.");
  const cover = coverFrames(fps, Boolean(script.coverUrl));
  const endpoint = resolved.totalFrames + cover;
  const anchors = musicBeatAnchors(map, endpoint / fps)
    .filter((anchor) => !anchor.disabled)
    .map((anchor) => ({
      frame: Math.round(anchor.seconds * fps),
      kind: "beat" as "beat" | "drop",
    }));
  if (map.dropSeconds !== null) {
    for (
      let loop = 0;
      loop + map.dropSeconds < endpoint / fps;
      loop += map.durationSeconds
    )
      anchors.push({
        frame: Math.round((loop + map.dropSeconds) * fps),
        kind: "drop",
      });
  }
  const clearance = Math.ceil(fps * 0.08);
  const distance = Math.round(fps * 0.35);
  const suggestions: CutSuggestion[] = [];
  const beats = resolved.timeline;
  const minimumHold = (index: number) => {
    const scene = script.scenes[index];
    return Math.ceil(
      fps *
        ((scene.hideText ?? script.hideText)
          ? 1
          : Math.max(1, Array.from(scene.text).length / 18)),
    );
  };
  for (let index = 1; index < beats.length; index++) {
    const previous = script.scenes[index - 1],
      scene = script.scenes[index];
    if (previous.locks?.scene || scene.locks?.scene) continue;
    // An appended/untimed scene must not be treated as known silence. Require
    // measured words inside each spoken scene's original recorded window.
    if (
      [index - 1, index].some(
        (i) =>
          resolveSpokenText(script.scenes[i]).trim() &&
          !words.some(
            (word) =>
              word.startFrame >= beats[i].startFrame &&
              word.endFrame <= beats[i].startFrame + beats[i].durationFrames,
          ),
      )
    )
      continue;
    const current = beats[index].startFrame + cover;
    const next = (beats[index + 1]?.startFrame ?? resolved.totalFrames) + cover;
    const start = beats[index - 1].startFrame + cover;
    const candidate = anchors
      .filter(
        (anchor) =>
          Math.abs(anchor.frame - current) <= distance &&
          anchor.frame - start >= minimumHold(index - 1) &&
          next - anchor.frame >= minimumHold(index) &&
          !words.some(
            (word) =>
              anchor.frame >= cover + word.startFrame - clearance &&
              anchor.frame <= cover + word.endFrame + clearance,
          ),
      )
      .sort(
        (a, b) =>
          Math.abs(a.frame - current) - Math.abs(b.frame - current) ||
          Number(b.kind === "drop") - Number(a.kind === "drop") ||
          a.frame - b.frame,
      )[0];
    if (candidate && candidate.frame !== current)
      suggestions.push({
        sceneId: scene.id,
        fromFrame: current,
        toFrame: candidate.frame,
        anchor: candidate.kind,
      });
  }
  return {
    fps,
    suggestions,
    reason: suggestions.length
      ? null
      : "No nearby reviewed anchors preserve speech and reading holds.",
  };
}
