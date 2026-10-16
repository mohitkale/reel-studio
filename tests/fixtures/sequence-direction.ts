import type { ReelProps, ReelScene } from "../../src/video/types";
import { defaultBrandTokens } from "../../src/video/tokens";
import { planMotionSequence } from "../../src/production/motion-plan";
import { collectSequenceSubjects } from "../../src/production/sequence-subjects";

export function sequenceFixture(
  film = 0,
  width = 1080,
  height = 1920,
): ReelProps {
  const labels =
    film === 0
      ? ["Collect", "Compose", "Review"]
      : film === 1
        ? ["Evidence", "Clarity", "Pacing"]
        : ["Draft", "Check", "Publish"];
  const extra = film === 0 ? "Publish" : film === 1 ? "Decision" : "Archive";
  const [a, b, c] = labels;
  const subjects = [
    [a, b, c],
    [a, b, c, extra],
    [c, b],
    [b, c, extra],
    [c, extra, a],
    [a, c, extra],
  ];
  const headlines =
    film === 0
      ? [
          "Start with a clear working sequence.",
          "Move each draft through the work.",
          "Return to the same checkpoints.",
          "Focus the next review.",
          "Keep the familiar steps visible.",
          "Carry the same checkpoints into the final pass.",
          "A consistent sequence makes progress easier to follow.",
        ]
      : film === 1
        ? [
            "Read the supplied checkpoints.",
            "Keep each checkpoint in the review.",
            "Return to the same evidence.",
            "Give the next pass a clear focus.",
            "Keep the review connected.",
            "Carry each checkpoint through the final pass.",
            "A clear review preserves the evidence behind each decision.",
          ]
        : [
            "Begin with three explicit stages.",
            "Move the work through each stage.",
            "Return to the familiar overview.",
            "Follow the supplied route.",
            "Keep the final checks connected.",
            "Follow the familiar final route.",
            "A deliberate finish gives the whole piece a clear destination.",
          ];
  const system = (["precision", "editorial", "poster"] as const)[film];
  const scenes: ReelScene[] = headlines.map((text, index) => ({
    id: `m3-${film}-${index}`,
    templateId: "hf-statement",
    text,
    emphasis: [],
    order: index,
    role:
      index === headlines.length - 1
        ? "summary"
        : index % 2
          ? "diagram"
          : "comparison",
    items: index === headlines.length - 1 ? undefined : subjects[index],
    motion: undefined,
  }));
  if (film === 0) scenes[1].items![0] = "Gather";
  const registry = collectSequenceSubjects(scenes)
    .filter((subject) => film !== 0 || subject.label !== "Gather")
    .map((subject) =>
      film === 0 && subject.label === a
        ? { ...subject, aliases: ["Gather"] }
        : subject,
    );
  const motions = planMotionSequence(
    scenes.map((scene) => ({
      ...scene,
      layout: { width, height, duration: 6 },
    })),
    {
      version: "1.0.0",
      seed: `m3-${film}`,
      system,
      ambition: "expressive",
      adaptiveRecipes: true,
      sequenceDirection: true,
      subjectRegistry: registry,
    },
  );
  return {
    width,
    height,
    fps: 30,
    tokens: defaultBrandTokens,
    sequenceDirection: { version: 1, subjects: registry },
    scenes: scenes.map((s, index) => ({ ...s, motion: motions[index] })),
    timeline: scenes.map((s, index) => ({
      sceneId: s.id,
      startFrame: index * 180,
      durationFrames: 180,
    })),
  };
}
