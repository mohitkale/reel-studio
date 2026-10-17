import { dimsFor } from "@/lib/orientation";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { parseSfxState } from "@/lib/sfx-cues";
import { videoSnapshotSchema, type VideoSnapshot } from "./video-snapshot";
import { withResolvedFilmPlan, filmDigest } from "./film-plan";
import {
  factoryDesignSchema,
  type FactoryProfileDocument,
  type FactoryVariant,
} from "./factory";
export interface FactoryRange {
  startFrame: number;
  endFrame: number;
  outputStart: number;
}

/** Complete source scenes only, in source order. Aspect adaptation never edits copy. */
export function deriveFactorySnapshot(
  source: VideoSnapshot,
  variant: FactoryVariant,
  profile?: FactoryProfileDocument,
) {
  const snapshot = videoSnapshotSchema.parse(structuredClone(source));
  delete snapshot.filmPlan;
  const original = snapshot.script.scenes,
    ids = original.map((scene) => scene.id);
  const selected = variant.kind === "cutdown" ? variant.sceneIds : ids;
  if (
    new Set(selected).size !== selected.length ||
    selected.some(
      (id, index) =>
        !ids.includes(id) ||
        (index > 0 && ids.indexOf(id) <= ids.indexOf(selected[index - 1])),
    )
  )
    throw new Error("Select unique source scenes in their original order");
  if (variant.kind === "cutdown" && selected.length === ids.length)
    throw new Error("A cutdown must remove at least one source scene");
  if (profile) {
    if (
      original.some((scene) => scene.locks?.scene) &&
      filmDigest(factoryDesignSchema.parse(snapshot.script)) !==
        filmDigest(profile.design)
    )
      throw new Error(
        "Whole-scene locks protect this film from a different series design",
      );
    Object.assign(
      snapshot.script,
      { visualTheme: undefined, productionPreset: undefined },
      profile.design,
    );
  }
  Object.assign(snapshot.script, dimsFor(variant.orientation));
  const ranges: FactoryRange[] = [];
  if (variant.kind === "cutdown") {
    const resolved = resolveReelTimeline(
      original.map((scene) => ({
        id: scene.id,
        text: resolveSpokenText(scene),
      })),
      snapshot.take,
      snapshot.script.fps,
    );
    if (
      snapshot.take &&
      (!resolved.takeUsable || snapshot.take.fps !== snapshot.script.fps)
    )
      throw new Error("Cutdown audio requires a complete matching-FPS take");
    let outputStart = 0;
    const timeline = selected.map((id) => {
      const beat = resolved.timeline.find((item) => item.sceneId === id)!;
      ranges.push({
        startFrame: beat.startFrame,
        endFrame: beat.startFrame + beat.durationFrames,
        outputStart,
      });
      const sourceBeat = snapshot.take?.timeline.find(
        (item) => item.sceneId === id,
      );
      const row = {
        ...beat,
        text: resolveSpokenText(original.find((scene) => scene.id === id)!),
        words: sourceBeat?.words?.map((word) => ({
          ...word,
          startFrame: word.startFrame + outputStart - beat.startFrame,
          endFrame: word.endFrame + outputStart - beat.startFrame,
        })),
        startFrame: outputStart,
      };
      outputStart += beat.durationFrames;
      return row;
    });
    if (outputStart > snapshot.script.fps * 180)
      throw new Error("Keep a cutdown within three minutes");
    snapshot.script.scenes = selected.map((id, order) => ({
      ...original.find((scene) => scene.id === id)!,
      order,
    }));
    snapshot.stockMedia = snapshot.stockMedia.filter((item) =>
      selected.includes(item.sceneId),
    );
    if (snapshot.take)
      snapshot.take = { ...snapshot.take, totalFrames: outputStart, timeline };
    snapshot.script.chapterPlan = undefined;
    snapshot.script.chapterDraft = undefined;
    if (snapshot.script.sfxJson) {
      const state = parseSfxState(snapshot.script.sfxJson);
      snapshot.script.sfxJson = JSON.stringify({
        ...state,
        cues: state.cues.filter((cue) => selected.includes(cue.sceneId)),
      });
    }
    snapshot.script.captionTracks = snapshot.script.captionTracks?.map(
      (track) => ({
        ...track,
        cues: track.cues.flatMap((cue) => {
          const touched = ranges.filter(
            (range) =>
              cue.startFrame < range.endFrame &&
              cue.endFrame > range.startFrame,
          );
          if (!touched.length) return [];
          const first = touched[0],
            last = touched.at(-1)!;
          // A caption crossing a removed passage cannot retain its exact text honestly.
          const covered = touched.reduce(
            (sum, range) =>
              sum +
              Math.max(
                0,
                Math.min(cue.endFrame, range.endFrame) -
                  Math.max(cue.startFrame, range.startFrame),
              ),
            0,
          );
          if (covered !== cue.endFrame - cue.startFrame)
            throw new Error(
              "A caption crosses a cut boundary. Split that cue before making this cutdown",
            );
          const shift = first.outputStart - first.startFrame;
          return [
            {
              ...cue,
              startFrame: cue.startFrame + shift,
              endFrame: last.outputStart + cue.endFrame - last.startFrame,
              words: cue.words?.map((word) => ({
                ...word,
                startFrame: word.startFrame + shift,
                endFrame: word.endFrame + shift,
              })),
            },
          ];
        }),
      }),
    );
  }
  return { snapshot, ranges, finalize: () => withResolvedFilmPlan(snapshot) };
}
