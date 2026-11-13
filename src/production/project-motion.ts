import type { ScenePlan } from "@/providers/ai/types";
import type { SceneBackground } from "@/video/types";
import type { EnergyId } from "@/video/visual-style";
import type { ProductionPresetId } from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import type { MotionDirection } from "@/production/motion";
import type { SceneLocks } from "@/library/schemas";
import type { VisualAmbition } from "@/production/motion-plan";
import {
  planMotionSequence,
  type MotionPlanSettings,
} from "@/production/motion-plan";
import { collectSequenceSubjects } from "@/production/sequence-subjects";
import { sourcePlanSeed } from "@/production/director";
import { defaultMotionSystem } from "@/production/motion-systems";
import type { VisualTheme } from "@/production/creative-direction";

/** The production options that decide how a new project's motion is planned. */
export interface ProjectMotionOptions {
  preset?: { id: ProductionPresetId; version: string };
  roles?: ProductionSceneRole[];
  motions?: Array<MotionDirection | undefined>;
  motionPlan?: MotionPlanSettings;
  visualAmbition?: VisualAmbition;
  visualTheme?: VisualTheme;
  sceneLocks?: Array<SceneLocks | undefined>;
}

/**
 * Plan the motion for a new project's scenes. Shared by project creation and by
 * the offline composition builder (frame checks), so both see the same plan.
 */
export function planProjectMotion(args: {
  plan: ScenePlan;
  directedScenes: ScenePlan["scenes"];
  production?: ProjectMotionOptions;
  width: number;
  height: number;
  energy: EnergyId;
  backgrounds: (SceneBackground | undefined)[];
}): {
  motionPlan: MotionPlanSettings | undefined;
  motions: Array<MotionDirection | undefined>;
} {
  const {
    plan,
    directedScenes,
    production,
    width,
    height,
    energy,
    backgrounds,
  } = args;
  const motionPlan: MotionPlanSettings | undefined =
    production?.motionPlan ??
    (production?.preset && !production.motions
      ? {
          version: "1.0.0",
          seed: sourcePlanSeed(
            JSON.stringify({ preset: production.preset, scenes: plan.scenes }),
          ),
          ambition: production.visualAmbition ?? "expressive",
          system: defaultMotionSystem(
            production.visualTheme?.id,
            production.preset.id,
          ),
          adaptiveRecipes: true,
          sequenceDirection: true,
        }
      : undefined);
  if (motionPlan?.sequenceDirection && !production?.motions)
    motionPlan.subjectRegistry = collectSequenceSubjects(
      directedScenes,
      motionPlan.subjectRegistry,
    );
  const motions =
    production?.motions ??
    (motionPlan
      ? planMotionSequence(
          directedScenes.map((scene, order) => ({
            role: production?.roles?.[order],
            layout: {
              width,
              height,
              duration: Math.max(
                3,
                Math.min(
                  120,
                  (scene.spokenText ?? scene.text).split(/\s+/).length / 2.5 +
                    1,
                ),
              ),
            },
            energy,
            text: scene.text,
            spokenText: scene.spokenText,
            direction: scene.direction,
            chart: scene.chart,
            items: scene.items,
            background: backgrounds[order],
            hasVisualContent: Boolean(scene.visual),
            current: scene.direction?.motion,
            locked: Boolean(production?.sceneLocks?.[order]?.scene),
          })),
          motionPlan,
        )
      : []);
  return { motionPlan, motions };
}
