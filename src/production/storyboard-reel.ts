/**
 * Build the composition for a storyboard without a database, a voice or a
 * network: the same scene plan, motion plan and estimated timing that
 * production would use, as the props the HyperFrames compiler takes. The frame
 * checks and the layout tools render this to look at every scene quickly.
 */
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { dimsFor } from "@/lib/orientation";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { buildAutoCaptionTrack } from "@/library/auto-captions";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { planProjectMotion } from "@/production/project-motion";
import { getProductionPreset } from "@/production/presets";
import { resolveProductionLayout } from "@/production/layout";
import { enrichSemanticSequence } from "@/production/semantic-direction";
import { planFromStoryboard } from "@/production/storyboard-plan";
import type { Storyboard } from "@/storyboard";
import type { ReelProps, ReelScene } from "@/video/types";

export interface StoryboardReel {
  props: ReelProps;
  /** Scene index to its [startFrame, endFrame) in the content timeline. */
  spans: Array<{ startFrame: number; endFrame: number }>;
  presetId: string;
}

export function storyboardToReelProps(storyboard: Storyboard): StoryboardReel {
  if (storyboard.kind !== "video")
    throw new Error("Only video storyboards have scenes");
  const plan = planFromStoryboard(storyboard);
  const preset = getProductionPreset(plan.presetId);
  if (!preset) throw new Error(`Unknown look ${plan.presetId}`);
  const { width, height } = dimsFor(plan.orientation);
  const fps = 30;

  const enriched = {
    ...plan.scenePlan,
    scenes: enrichScenePlan(plan.scenePlan.scenes, "hyperframes"),
  };
  const directed = enrichSemanticSequence(enriched.scenes);
  const styleId = preset.defaults.styleId;
  const energy = preset.defaults.energy;
  const { motions } = planProjectMotion({
    plan: enriched,
    directedScenes: directed,
    production: {
      preset: { id: preset.id, version: preset.version },
      roles: plan.roles,
      visualAmbition: "expressive",
    },
    width,
    height,
    energy,
    backgrounds: [],
  });

  const scenes: ReelScene[] = directed.map((scene, order) => ({
    id: `scene-${order}`,
    templateId: scene.templateId,
    text: scene.text,
    spokenText: scene.spokenText,
    emphasis: scene.emphasis ?? [],
    visual: scene.visual,
    items: scene.items,
    chart: scene.chart,
    role: scene.direction?.graphic ? scene.direction.role : plan.roles[order],
    motion: motions[order],
    direction: scene.direction,
    mood: scene.mood,
    order,
  })) as ReelScene[];

  const resolved = resolveReelTimeline(
    scenes.map((scene) => ({ id: scene.id, text: resolveSpokenText(scene) })),
    null,
    fps,
  );
  const spans = resolved.timeline.map((beat) => ({
    startFrame: beat.startFrame,
    endFrame: beat.startFrame + beat.durationFrames,
  }));

  const track = buildAutoCaptionTrack({
    scriptId: "frame-check",
    presetId: preset.id,
    take: {
      id: "estimated",
      scriptId: "frame-check",
      label: null,
      providerId: "estimate",
      voiceId: "estimate",
      modelId: null,
      fps,
      totalFrames: resolved.totalFrames,
      timeline: resolved.timeline.map((beat, index) => ({
        sceneId: beat.sceneId,
        startFrame: beat.startFrame,
        durationFrames: beat.durationFrames,
        text: resolveSpokenText(scenes[index]!),
      })),
      audioUrl: "",
      isPlaceholder: true,
      source: "oneshot",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  });

  const props: ReelProps = {
    scenes,
    timeline: resolved.timeline.map((beat) => ({
      sceneId: beat.sceneId,
      startFrame: beat.startFrame,
      durationFrames: beat.durationFrames,
    })),
    tokens: serverDefaultTokens,
    width,
    height,
    fps,
    styleId,
    energy,
    layout: resolveProductionLayout({ width, height }),
    preset: { id: preset.id, version: preset.version },
    captions: track
      ? {
          enabled: true,
          timingSource: "estimated",
          style: track.style,
          cues: track.cues.map((cue) => ({
            id: cue.id,
            startFrame: cue.startFrame,
            endFrame: cue.endFrame,
            text: cue.text,
          })),
        }
      : undefined,
  } as ReelProps;
  return { props, spans, presetId: preset.id };
}
