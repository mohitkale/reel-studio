import type { GeneratePlanInput } from "./types";

// Rotated on every call (not user-controlled) purely to push the model away
// from its single most-likely completion for a given brief, so re-generating
// the same idea doesn't produce a near-identical script every time.
const CREATIVE_ANGLES = [
  "a confident expert sharing an insider secret",
  "a curious skeptic who just discovered this and can't believe it",
  "a fast-paced listicle countdown energy",
  "a warm, relatable storyteller voice",
  "a bold contrarian challenging common wisdom",
  "a behind-the-scenes, 'nobody tells you this' framing",
  "a before/after transformation narrative",
  "a mentor giving direct, no-fluff advice",
];

function pickCreativeAngle(): string {
  return CREATIVE_ANGLES[Math.floor(Math.random() * CREATIVE_ANGLES.length)];
}

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
  const style = input.scriptStyle ?? "short";
  const isDetailed = style === "detailed";

  const count = input.sceneCount
    ? `${input.sceneCount}`
    : isAppend
      ? "3 to 5"
      : isDetailed
        ? "between 6 and 20"
        : "between 5 and 16";

  const orientation = input.orientation ?? "portrait";
  const ASPECT: Record<typeof orientation, string> = {
    portrait: "vertical 9:16 (TikTok, Reels, Shorts)",
    landscape: "widescreen 16:9 (YouTube, landscape)",
    square: "square 1:1 (feed posts)",
  };
  const aspect = ASPECT[orientation];

  // For append mode: output ONLY the new scenes — not the full script.
  const countRule = isAppend
    ? `- Output ONLY the ${count} NEW scenes you are adding. Do NOT repeat or include any existing scenes in your JSON output.`
    : `- Use ${count} scenes total. If the user's brief explicitly requests a specific number, honour it (max 20).`;

  const lengthRule = isDetailed
    ? "- Each scene is 2 to 4 spoken sentences (about 30 to 45 words). Give the narration real substance — a concrete example, a specific number, or a vivid detail — not just a punchy tagline."
    : "- Each scene is one or two short spoken sentences (about 18 words max).";

  const structureRule = isDetailed
    ? "- Shape the overall video as a real story arc: setup (what's the situation) -> context (why it matters) -> conflict or insight (the turn, problem, or key idea) -> payoff (the resolution, result, or lesson) -> call to action. Let scenes breathe — it's OK to spend 2-3 scenes developing one idea before moving on."
    : "- Every scene must create a curiosity gap that pulls the viewer into the next.";

  const system = [
    `You are a viral short-form video director producing a ${aspect} video.`,
    "Your single goal: maximum retention. Viewers decide in 3 seconds whether to keep watching or swipe.",
    `Creative direction for this take: write in the voice/energy of ${pickCreativeAngle()}. Even for a familiar topic, find a fresh, specific angle — avoid generic, interchangeable phrasing.`,
    "Rules:",
    "- Plain, conversational English. No em-dashes. No corporate filler.",
    "- NEVER use markdown in any field (no asterisks, underscores, backticks, or other formatting). All scene text is spoken aloud by a voiceover — write plain words only (e.g. 'great', not '*great*' or '**great**').",
    lengthRule,
    countRule,
    "- Scene 1 MUST be a scroll-stopping hook: a surprising fact, bold claim, relatable problem, contrarian take, or direct question.",
    structureRule,
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
    "  MOOD & MUSIC — every scene needs one, whether or not it has a photo:",
    "  • mood: pick the single best fit from energetic, calm, dramatic, playful, inspiring, tech, nature — this drives the animated background style and color treatment when there's no photo, so vary it across scenes to match each beat's emotional tone (a hook can be 'dramatic', a tip can be 'playful', a stat can be 'tech', etc.).",
    "  • musicMood: 1 to 3 words describing the ideal background music vibe for that beat (e.g. 'uplifting lo-fi', 'tense cinematic', 'chill acoustic', 'epic build'). Keep it consistent enough across the video that the music doesn't feel like it's whiplashing scene to scene, but let it evolve with the story arc.",
    "  CINEMATIC BACKGROUNDS — make it feel professionally produced:",
    "  • backgroundQuery: for scenes that a real photo elevates (a place, object, mood, scene-setting, or emotional beat), add 2 to 4 concrete, literal visual keywords for a stock photo (e.g. 'sunrise mountain trail', 'busy modern office', 'fresh coffee beans'). Be specific and photographable — not abstract concepts.",
    "  • Use backgroundQuery on roughly 40 to 70% of scenes. OMIT it for clean text-only beats (most stat-reveal, icon-grid, quote-card and emoji-punch scenes look best WITHOUT a busy photo behind them) — those scenes rely on `mood` instead for a dynamic, on-brand animated background.",
    "  • effect: pick a pan/zoom motion from ken-burns, pan-left, pan-right, pan-up, pan-down. VARY it across scenes so the video feels dynamic; default to ken-burns for hero shots.",
    `  • The photo will be cropped full-bleed to a ${aspect} frame, so prefer subjects that read well at that shape.`,
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
