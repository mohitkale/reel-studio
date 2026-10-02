import {
  MOTION_RECIPES,
  motionDirection,
  type MotionRecipeId,
} from "../../src/production/motion";
import { defaultBrandTokens } from "../../src/video/tokens";
import type { ReelProps, ReelScene } from "../../src/video/types";
const content: Record<MotionRecipeId, Partial<ReelScene> & { text: string }> = {
  "type-stack": { text: "Make space for clarity.", role: "emphasis" },
  "type-impact": { text: "Make every word matter.", role: "hook" },
  "type-editorial": {
    text: "Give a useful idea room to breathe.",
    role: "headline",
  },
  "data-spotlight": {
    text: "Show the supplied result.",
    role: "metric",
    chart: {
      labels: ["Completion"],
      series: [{ label: "Supplied fixture", values: [72], unit: "%" }],
      sourceAttribution: "Synthetic verification data",
    },
  },
  "data-bars": {
    text: "Compare the supplied results.",
    role: "chart",
    chart: {
      labels: ["Draft", "Review", "Release"],
      series: [{ label: "Supplied fixture", values: [42, 68, 91], unit: "%" }],
      sourceAttribution: "Synthetic verification data",
    },
  },
  "diagram-path": {
    text: "From a clear idea to a finished story.",
    role: "diagram",
    items: ["Idea", "Compose", "Export"],
  },
  "diagram-orbit": {
    text: "Keep the central idea in focus.",
    role: "diagram",
    items: ["Idea", "Copy", "Timing", "Design"],
  },
  "media-device": {
    text: "See your product in context.",
    role: "screenshot-demo",
    background: { type: "image", url: "fixture.jpg" },
  },
  "media-cinematic": {
    text: "Put the story in focus.",
    role: "hero",
    background: { type: "image", url: "fixture.jpg" },
  },
  "comparison-split": {
    text: "Two ways to tell the story.",
    role: "comparison",
    items: ["A focused opening", "A clear conclusion"],
  },
  "comparison-stack": {
    text: "Two ways to tell the story.",
    role: "comparison",
    items: ["A focused opening", "A clear conclusion"],
  },
  "quiet-divider": { text: "Let the next idea breathe.", role: "summary" },
  "quiet-center": {
    text: "Clarity leaves a lasting impression.",
    role: "explanation",
  },
  "brand-lockup": { text: "Make something worth sharing.", role: "cta" },
  "brand-frame": { text: "Your next story starts here.", role: "logo" },
};
export function motionLibraryFixture(width = 540, height = 960): ReelProps {
  const fps = 24;
  const scenes = MOTION_RECIPES.map((recipe, order): ReelScene => ({
    id: recipe.id,
    templateId: "hf-statement",
    emphasis: [],
    order,
    ...content[recipe.id],
    motion: motionDirection(recipe.id),
  }));
  return {
    width,
    height,
    fps,
    tokens: { ...defaultBrandTokens, handle: "STORY STUDIO" },
    scenes,
    timeline: scenes.map((scene, index) => ({
      sceneId: scene.id,
      startFrame: index * fps * 3,
      durationFrames: index === scenes.length - 1 ? fps * 12 : fps * 3,
    })),
  };
}
