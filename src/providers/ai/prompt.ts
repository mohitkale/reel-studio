import type { GeneratePlanInput } from "./types";

/**
 * Shared director prompt. Produces a short-form (9:16) scene plan. Templates the
 * model can choose: kinetic (punchy headline text), lottie (explainer/step with
 * an animated icon), three (bold 3D hero moment).
 */
export function buildPrompt(input: GeneratePlanInput): {
  system: string;
  user: string;
} {
  const count = input.sceneCount
    ? `${input.sceneCount}`
    : "between 5 and 7";

  const system = [
    "You are a short-form video director for vertical (9:16) TikTok, Reels and Shorts.",
    "Write a concise, high-retention scene plan.",
    "Rules:",
    "- Plain, simple English. Do not use em-dashes.",
    "- Each scene is one or two short spoken sentences (about 18 words max).",
    `- Use ${count} scenes total.`,
    "- Scene 1 must be a strong hook. The last scene must include a clear call to action.",
    "- For each scene pick templateId from exactly: kinetic, lottie, three.",
    "  Use 'three' for at most one high-impact scene, 'lottie' for an explainer or step, 'kinetic' for the rest.",
    "- emphasis: 1 to 3 short phrases that appear VERBATIM inside that scene's text, for on-screen highlight.",
    "- projectName: 2 to 4 words. scriptName: a short, catchy episode title.",
    "Return only JSON that matches the provided schema.",
  ].join("\n");

  const user =
    input.mode === "idea"
      ? `Create a short-form video from this idea:\n\n${input.brief}`
      : `Turn this story or script into a short-form video scene plan. Keep the meaning but tighten the wording for spoken delivery:\n\n${input.brief}`;

  return { system, user };
}
