import type { GeneratePlanInput } from "./types";

// Rotated on every call to vary voice without changing the product rules below.
const CREATIVE_ANGLES = [
  "a warm mentor talking one-to-one with the viewer",
  "a calm expert who has made the mistake and learned the fix",
  "a friend sharing a specific, useful secret — not hype",
  "a clear coach: kind tone, high standards, zero fluff",
  "a trusted guide walking the viewer through one insight",
];

function pickCreativeAngle(): string {
  return CREATIVE_ANGLES[Math.floor(Math.random() * CREATIVE_ANGLES.length)];
}

/**
 * Shared director prompt. Retention-first, personal "you" voice, and layout
 * rules that keep the video easy on the eyes (no clunky one-item checklists).
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
        : "between 5 and 12";

  const orientation = input.orientation ?? "portrait";
  const ASPECT: Record<typeof orientation, string> = {
    portrait: "vertical 9:16 (TikTok, Reels, Shorts)",
    landscape: "widescreen 16:9 (YouTube, landscape)",
    square: "square 1:1 (feed posts)",
  };
  const aspect = ASPECT[orientation];

  const countRule = isAppend
    ? `- Output ONLY the ${count} NEW scenes you are adding. Do NOT repeat or include any existing scenes in your JSON output.`
    : `- Use ${count} scenes total. If the user's brief explicitly requests a specific number, honour it (max 20).`;

  const lengthRule = isDetailed
    ? "- Each scene has TWO copy fields: (1) 'text' = short ON-SCREEN line (about 12 to 18 words, easy to read at a glance). (2) 'spokenText' = the VOICEOVER script, about 2 to 3 times longer than 'text' (about 30 to 55 words, 2 to 3 spoken sentences). spokenText expands the same beat with one concrete detail, example, or number — never filler. emphasis phrases should appear in 'text' (preferred) or 'spokenText'."
    : "- Each scene is one short spoken sentence, or two very short ones (about 14 words max). Put that in 'text' only. Leave 'spokenText' empty — voice uses the same words as on screen.";

  const structureRule = isDetailed
    ? "- Shape: Hook → why it matters to YOU → insight → proof or short steps → punch → soft CTA. Let the spokenText breathe while on-screen text stays scannable."
    : "- Shape: Hook → relatable problem → insight or proof → punch → clear CTA. Every beat earns the next second of attention.";

  const styleLock =
    input.styleId && input.styleId !== "auto"
      ? `- styleId MUST be exactly "${input.styleId}".`
      : `- styleId: pick ONE whole-reel look from bold-hook, clean-story, teach-me, soft-brand.
  • bold-hook — sharp hooks and tips (still keep contrast calm)
  • clean-story — premium brand story, soothing pace
  • teach-me — explainers with clear lists/stats
  • soft-brand — lifestyle / wellness / high-trust soft motion
  Prefer clean-story or soft-brand when the brief is personal, brand, or lifestyle; teach-me for how-tos; bold-hook for punchy tips.`;

  const energyLock =
    input.energy && input.energy !== "auto"
      ? `- energy MUST be exactly "${input.energy}".`
      : `- energy: calm, normal, or high. Prefer normal or calm — the video should feel professional and soothing, not frantic. Use high only for explicit hype briefs.`;

  const system = [
    `You are a short-form video director for ${aspect}.`,
    "Viewer reality: they are scrolling. You have ~3 seconds. Sound may be off. Text must be readable. The feel should be personal (talk to 'you') and professional — calm confidence, not shouting ads.",
    `Creative direction for this take: write in the voice of ${pickCreativeAngle()}. Specific beats beat generic advice.`,
    "Rules:",
    "- Plain conversational English. Use 'you' and 'your'. No em-dashes. No corporate filler. No clickbait all-caps energy in the words.",
    "- NEVER use markdown in any field. Scene text and spokenText are spoken aloud — plain words only.",
    lengthRule,
    countRule,
    "- Scene 1 MUST hook with one of: (1) a bold but believable claim to the viewer, (2) a surprising number, (3) 'Stop doing X' with a kinder fix promised, (4) a direct question about their life, (5) a pain they feel today — said warmly, not mocked.",
    structureRule,
    "- Last scene: a clear, low-pressure CTA (try this, save this, follow for more).",
    "- Never use the same templateId for two consecutive scenes.",
    "- For each scene pick templateId from: kinetic, lottie, three, stat-reveal, icon-grid, quote-card, emoji-punch.",
    "  TEMPLATE RULES — follow precisely (wrong layout = unwatchable):",
    "  • 'stat-reveal': scene centered on ONE number/metric. visual = that number (e.g. '73%', '10x'). Keep supporting text short.",
    "  • 'icon-grid': ONLY when you have 3 to 5 SHORT tip/step lines (max ~8 words each). REQUIRED: put those lines in the 'items' array; put a short header (2–5 words) in 'text'; set visual to '✓' or '→'. NEVER use icon-grid for a single point, a long paragraph, or 1–2 long sentences. If you only have one idea, use 'kinetic' instead.",
    "  • 'emoji-punch': short emotional punch / turn; visual = one emoji. Keep text under ~12 words.",
    "  • 'quote-card': short attributed line; visual = speaker (optional).",
    "  • 'lottie': one clear process/how-it-works beat — not a wall of text.",
    "  • 'three': the single hero moment of the video — use EXACTLY once.",
    "  • 'kinetic': default for one clear spoken idea / hook / insight. Prefer this over a fake checklist.",
    "  DIVERSITY: 5+ scenes → at least 4 different templates. kinetic ≤ 40% of scenes. Never kinetic more than twice in a row.",
    "- emphasis: 1–2 short phrases that appear VERBATIM in that scene's text (highlights for the eye).",
    "- visual: only as required above; otherwise omit. Keep it SHORT (a number, one emoji, or a CTA label under ~20 characters).",
    "  LOOK OF THE WHOLE VIDEO:",
    styleLock,
    energyLock,
    "  MOOD & MUSIC — easy on the eyes:",
    "  • mood: energetic|calm|dramatic|playful|inspiring|tech|nature. Prefer calm / inspiring / tech for most beats. Use dramatic sparingly (hooks). Avoid stacking playful + energetic back-to-back neon feels.",
    "  • musicMood: 1–3 words, gentle progression (e.g. 'warm lo-fi', 'soft cinematic', 'calm focus'). No whiplash.",
    "  BACKGROUNDS:",
    "  • backgroundQuery: 2–4 literal photo keywords when a photo helps (place, object, atmosphere). Prefer soft, uncluttered subjects.",
    "  • Use backgroundQuery on ~30–50% of scenes. OMIT for stat-reveal, icon-grid, quote-card, emoji-punch — those need clean type, not busy photos.",
    "  • effect: ken-burns|pan-left|pan-right|pan-up|pan-down — vary gently; ken-burns for hero beats.",
    `  • Photos crop to ${aspect} — choose subjects that read in that frame.`,
    "- projectName: 2 to 4 words. scriptName: short, human episode title.",
    "Return only JSON that matches the provided schema.",
  ].join("\n");

  let user: string;
  if (input.mode === "idea") {
    user = `Create a personal, high-retention short-form video from this idea. Speak to one viewer who needs this today:\n\n${input.brief}`;
  } else if (input.mode === "story") {
    user = `Turn this into a calm, professional short-form scene plan. Keep the human voice; tighten for spoken delivery:\n\n${input.brief}`;
  } else if (input.mode === "rewrite") {
    const ctx = input.existingContext
      ? `\n\nExisting scenes for context (rewrite entirely — don't just paraphrase):\n${input.existingContext}`
      : "";
    user = `Rewrite this short video to feel more personal, clearer, and harder to scroll past. Strong hook in scene 1. Keep the tone professional and soothing — not shouty.\n\nTopic: ${input.brief}${ctx}`;
  } else {
    const startNum = input.existingSceneCount != null ? input.existingSceneCount + 1 : "next";
    const ctx = input.existingContext
      ? `\n\nExisting scenes (do NOT repeat these):\n${input.existingContext}`
      : "";
    user = `Add scenes ${startNum}+ to a short video that already has ${input.existingSceneCount ?? "several"} scenes.\n\nRules:\n- Fresh value only.\n- No CTA (the video already ends with one).\n- Start with a curiosity gap that still feels kind and clear.${ctx}\n\nFocus: ${input.brief}`;
  }

  return { system, user };
}
