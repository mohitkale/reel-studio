import type { GeneratePlanInput } from "./types";

/**
 * Shared director prompt. Produces a short-form (9:16) scene plan.
 * Template guide:
 *   kinetic     - punchy headline text reveal, the default workhorse
 *   lottie      - explainer or process step with a vector animation
 *   three       - bold 3D hero moment (use at most once)
 *   stat-reveal - big stat/number reveal; set visual to the key number e.g. "73%"
 *   icon-grid   - checklist or tips; set visual to a bullet emoji e.g. "✓"
 *   quote-card  - quote or testimonial; visual is optional author/attribution
 *   emoji-punch - single big emoji punchline; set visual to the emoji e.g. "🔥"
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
    "- For each scene pick templateId from exactly: kinetic, lottie, three, stat-reveal, icon-grid, quote-card, emoji-punch.",
    "  Use 'three' for at most one high-impact scene.",
    "  Use 'lottie' for explainer or process steps.",
    "  Use 'stat-reveal' when a scene features a key number or metric; set visual to that number (e.g. '73%' or '10x').",
    "  Use 'icon-grid' for a list of tips or steps; set visual to a bullet emoji (e.g. '✓' or '→').",
    "  Use 'quote-card' for a quote or testimonial; visual is optional (e.g. an emoji or author name).",
    "  Use 'emoji-punch' for a punchy one-liner with a single emoji; set visual to a relevant emoji (e.g. '🔥' or '⚡').",
    "  Use 'kinetic' for all other scenes.",
    "- emphasis: 1 to 3 short phrases that appear VERBATIM inside that scene's text, for on-screen highlight.",
    "- visual: a single emoji, short stat, or brief label as described above. Omit when not applicable.",
    "- projectName: 2 to 4 words. scriptName: a short, catchy episode title.",
    "Return only JSON that matches the provided schema.",
  ].join("\n");

  const user =
    input.mode === "idea"
      ? `Create a short-form video from this idea:\n\n${input.brief}`
      : `Turn this story or script into a short-form video scene plan. Keep the meaning but tighten the wording for spoken delivery:\n\n${input.brief}`;

  return { system, user };
}
