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
  const isAppend = input.mode === "append";
  const count = input.sceneCount
    ? `${input.sceneCount}`
    : isAppend ? "3 to 5" : "between 5 and 16";

  // For append mode: output ONLY the new scenes — not the full script.
  const countRule = isAppend
    ? `- Output ONLY the ${count} NEW scenes you are adding. Do NOT repeat or include any existing scenes in your JSON output.`
    : `- Use ${count} scenes total. If the user's brief explicitly requests a specific number, honour it (max 20).`;

  const system = [
    "You are a viral short-form video director for vertical (9:16) TikTok, Reels and Shorts.",
    "Your single goal: maximum retention. Viewers decide in 3 seconds whether to keep watching or swipe.",
    "Rules:",
    "- Plain, conversational English. No em-dashes. No corporate filler.",
    "- Each scene is one or two short spoken sentences (about 18 words max).",
    countRule,
    "- Scene 1 MUST be a scroll-stopping hook: a surprising fact, bold claim, relatable problem, contrarian take, or direct question.",
    "- Every scene must create a curiosity gap that pulls the viewer into the next.",
    "- The last scene must include a clear call to action (follow, try this, share, etc.).",
    "- For each scene pick templateId from: kinetic, lottie, three, stat-reveal, icon-grid, quote-card, emoji-punch.",
    "  TEMPLATE RULES — follow precisely:",
    "  • 'stat-reveal': ANY scene with a number, stat, or metric. REQUIRED: set visual to the number string (e.g. '73%', '10x', '$2B'). Do NOT use kinetic for stats.",
    "  • 'icon-grid': ANY scene listing 3+ tips, steps, or items. REQUIRED: set visual to a bullet emoji (e.g. '✓', '→', '⚡'). Do NOT use kinetic for lists.",
    "  • 'emoji-punch': ANY punchline, emotional beat, surprising reveal, or reaction. REQUIRED: set visual to a fitting emoji (e.g. '🔥', '😱', '💡', '⚡'). Use liberally.",
    "  • 'quote-card': quotes, testimonials, or attributed statements. visual = speaker name (optional).",
    "  • 'lottie': process steps, how-it-works explanations, abstract concept reveals.",
    "  • 'three': the single most powerful hero moment in the whole video — use EXACTLY once.",
    "  • 'kinetic': text-focused scenes ONLY when none of the above templates fit. LIMIT to 40% of total scenes.",
    "  DIVERSITY RULE: in any video with 5+ scenes, you MUST use at least 4 different templates. Never use kinetic for more than 2 consecutive scenes.",
    "- emphasis: 1 to 3 short phrases that appear VERBATIM inside that scene's text, for on-screen highlight.",
    "- visual: a single emoji, short stat, or brief label as described. Omit when not applicable.",
    "- projectName: 2 to 4 words. scriptName: a short, catchy episode title.",
    "Return only JSON that matches the provided schema.",
  ].join("\n");

  let user: string;
  if (input.mode === "idea") {
    user = `Create a highly engaging short-form video from this idea:\n\n${input.brief}`;
  } else if (input.mode === "story") {
    user = `Turn this story or script into a high-retention short-form video scene plan. Tighten the wording for spoken delivery:\n\n${input.brief}`;
  } else if (input.mode === "rewrite") {
    const ctx = input.existingContext
      ? `\n\nExisting scenes for context (rewrite entirely — don't just paraphrase):\n${input.existingContext}`
      : "";
    user = `Completely rewrite this short video to be more engaging, more current, and more viral. Start with a strong scroll-stopping hook in scene 1.\n\nTopic: ${input.brief}${ctx}`;
  } else {
    // append
    const startNum = input.existingSceneCount != null ? input.existingSceneCount + 1 : "next";
    const ctx = input.existingContext
      ? `\n\nExisting scenes (do NOT repeat or reference these):\n${input.existingContext}`
      : "";
    user = `You are adding scenes ${startNum}+ to a short video that already has ${input.existingSceneCount ?? "several"} scenes.\n\nRules for these new scenes:\n- Each scene adds fresh, specific value — no repetition of existing content.\n- Build a logical progression: if existing scenes introduce the topic, these should go deeper, show examples, or reveal insights.\n- Do NOT add a call-to-action — the video already ends with one.\n- Start scene ${startNum} with a strong curiosity-gap hook that connects from the previous content.${ctx}\n\nFocus of the new scenes: ${input.brief}`;
  }

  return { system, user };
}
