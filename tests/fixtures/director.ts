import { createDeterministicProductionPlan } from "../../src/production/manual-planner";
import { applyPresetToAIPlan } from "../../src/production/ai-preset-plan";
import { planMotionSequence } from "../../src/production/motion-plan";
import { defaultBrandTokens } from "../../src/video/tokens";
import type { ReelProps } from "../../src/video/types";

export const DIRECTOR_SOURCE = 'Completion reached 42%.\n\nAlpha: 42%; Beta: 57%\n\n- Capture\n- Review\n- Export\n\nShe said “Keep every supplied word.”\n\nManual editing versus guided creation';
export function directorFixture(width = 540, height = 960): ReelProps {
  const initial = createDeterministicProductionPlan({ name: "Director fixture", text: DIRECTOR_SOURCE,
    presetId: "editorial-explainer", videoEngine: "hyperframes", hasVisualAsset: false });
  const directed = applyPresetToAIPlan(initial.plan, "editorial-explainer", "hyperframes", { source: DIRECTOR_SOURCE });
  const motion = planMotionSequence(directed.plan.scenes.map((scene, index) => ({
    ...scene, role: directed.roles[index], hasVisualContent: Boolean(scene.visual),
  })), { version: "1.0.0", seed: "director-acceptance", ambition: "expressive" });
  return { width, height, fps: 30, tokens: { ...defaultBrandTokens, handle: "STORY STUDIO" },
    scenes: directed.plan.scenes.map((scene, index) => ({ ...scene, id: `beat-${index}`, role: directed.roles[index], motion: motion[index] })),
    timeline: directed.plan.scenes.map((_, index) => ({ sceneId: `beat-${index}`, startFrame: index * 120, durationFrames: 120 })),
    spokenWords: [{ startFrame: 370, endFrame: 390 }], hideProgressBar: true };
}
