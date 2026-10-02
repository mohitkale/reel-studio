import type { GeneratePlanInput } from "./types";
import { allowedPresetCapabilityIds } from "@/production/ai-preset-plan";
import { getProductionPreset } from "@/production/presets";

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

function hyperframesTemplateRules(): string[] {
  return [
    "- For each scene pick capabilityId from the supplied HyperFrames capability enum. Pick by scene role and required inputs; the app maps it to a version-compatible template.",
    "  TEMPLATE RULES — HyperFrames director (wrong layout = unwatchable):",
    "  • Use 'hf.catalog.block.caption-kinetic-slam' only when a caption slam fits.",
    "  • For an explicit CTA, prefer 'hf.catalog.block.logo-outro' or 'hf.catalog.block.instagram-follow'.",
    "  • 'hf.catalog.block.apple-money-count': ONE big number/metric. visual = that amount (e.g. '$10k', '73%', '10x').",
    "  • 'hf.template.stat': short proof number beat. visual = the number.",
    "  • 'hf.catalog.block.data-chart': use only when the brief supplies exact chart data. Return chart.labels plus chart.series values of matching length and optional units/sourceAttribution. Never estimate or invent values; otherwise choose hf.template.statement.",
    "  • 'hf.template.list': ONLY with 3 to 5 SHORT tip/step lines in 'items' (max ~8 words each); 'text' = short header; visual = '✓' or '→'.",
    "  • Carousel capabilities require at least three project-supplied images. Do not choose one from a text-only brief.",
    "  • 'hf.template.quote': short attributed line; visual = speaker (optional).",
    "  • 'hf.catalog.block.app-showcase': product/process hero beat — use at most once.",
    "  • 'hf.template.statement' / 'hf.template.opener': one clear spoken idea / calm beat between hooks.",
    "  • 'hf.catalog.block.yt-lower-third': mid-reel identity/subscribe beat — use sparingly (0–1).",
    "  • 'hf.template.cta': text end-card when logo/social outros do not fit.",
    "  Choose layouts by content fit. Repeating a clear layout is better than forced variety.",
  ];
}

/**
 * Shared director prompt. Retention-first, personal "you" voice, and layout
 * rules that keep the video easy on the eyes (no clunky one-item checklists).
 * Template rules target the HyperFrames catalog.
 */
export function buildPrompt(input: GeneratePlanInput): {
  system: string;
  user: string;
} {
  if (input.mode === "chapter_outline") {
    const capability = "hf.template.statement";
    return {
      system: `Plan a coherent chapter outline for a creator. Return the existing JSON plan schema, with exactly ${input.sceneCount} entries in scenes. Each entry is a proposed chapter, not a finished scene: text is a distinct chapter title (1–120 characters), spokenText is a writing brief (3–2000 characters) with purpose, supplied facts and a takeaway. Use plain conversational English. Preserve supplied facts; never invent statistics, sources, product claims or URLs. Do not repeat previous chapters or write full narration. Set capabilityId to ${capability}, emphasis to [], styleId to clean-story and energy to calm. Omit media, charts and visual fields. Include short projectName and scriptName values. Return only JSON that matches the provided schema.`,
      user: `Topic and supplied source:\n${input.brief}\n\nPrior context (do not rewrite):\n${input.existingContext ?? "None"}`,
    };
  }
  const isAppend = input.mode === "append";
  const isRewrite = input.mode === "rewrite";
  const isHookVariants = input.mode === "hook_variants";
  const style = input.scriptStyle ?? "short";
  const isDetailed = style === "detailed";

  const count = input.sceneCount
    ? `${input.sceneCount}`
    : isHookVariants
      ? "3"
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

  const countRule = isHookVariants
    ? `- Output exactly ${count} alternative opening scenes. Each scene is a distinct option for the same first beat.`
    : isAppend
      ? `- Output ONLY the ${count} NEW scenes you are adding. Do NOT repeat or include any existing scenes in your JSON output.`
      : isRewrite && input.replacementSceneNumbers?.length
        ? `- Output exactly ${input.replacementSceneNumbers.length} replacement scenes for positions ${input.replacementSceneNumbers.join(", ")}, in that order. Do not return locked or unselected scenes.`
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

  const photoOmit =
    "OMIT for hf-stat, hf-list, hf-quote, hf-cta, hf-kinetic-slam, hf-money-count, hf-data-chart, and social/logo outros — those need clean type, not busy photos.";
  const mediaIntentRule =
    input.mediaPreference === "none"
      ? "  • Omit backgroundQuery and mediaKind. The user disabled stock media."
      : input.mediaPreference === "image"
        ? "  • When backgroundQuery is present, mediaKind must be image."
        : input.mediaPreference === "video"
          ? "  • When backgroundQuery is present, mediaKind must be video."
          : "  • When backgroundQuery is present, mediaKind may be image or video. Prefer image unless motion materially helps the beat.";

  const preset = input.productionPresetId
    ? getProductionPreset(input.productionPresetId)
    : undefined;
  const presetRule = preset
    ? `- Production preset is ${preset.name}. Use only these capability IDs: ${allowedPresetCapabilityIds(
        preset.id,
        input.videoEngine ?? "hyperframes",
      ).join(", ")}. Choose by content fit.`
    : undefined;

  const system = [
    `You are a short-form video director for ${aspect} using the HyperFrames HTML template catalog.`,
    "Viewer reality: they are scrolling. You have ~3 seconds. Sound may be off. Text must be readable. The feel should be personal (talk to 'you') and professional — calm confidence, not shouting ads.",
    `Creative direction for this take: write in the voice of ${pickCreativeAngle()}. Specific beats beat generic advice.`,
    "Rules:",
    "- Plain conversational English. Use 'you' and 'your'. No em-dashes. No corporate filler. No clickbait all-caps energy in the words.",
    "- NEVER use markdown in any field. Scene text and spokenText are spoken aloud — plain words only.",
    lengthRule,
    countRule,
    ...(presetRule ? [presetRule] : []),
    "- Open with the clearest useful idea for the brief. A bold claim, supplied number, direct question, or current pain can work when supported by the source.",
    structureRule,
    "- When the brief calls for an action, end with a clear, low-pressure CTA (try this, save this, follow for more).",
    ...hyperframesTemplateRules(),
    "- emphasis: 1–2 short phrases that appear VERBATIM in that scene's text (highlights for the eye).",
    "- visual: only as required above; otherwise omit. Keep it SHORT (a number, one emoji, or a CTA label under ~20 characters).",
    "- Never invent statistics, chart values, testimonials, URLs, customers, or product results. Use only facts in the brief or supplied source; choose a non-data layout when facts are missing.",
    "  LOOK OF THE WHOLE VIDEO:",
    styleLock,
    energyLock,
    "  MOOD & MUSIC — easy on the eyes:",
    "  • mood: energetic|calm|dramatic|playful|inspiring|tech|nature. Prefer calm / inspiring / tech for most beats. Use dramatic sparingly (hooks). Avoid stacking playful + energetic back-to-back neon feels.",
    "  • musicMood: 1–3 words, gentle progression (e.g. 'warm lo-fi', 'soft cinematic', 'calm focus'). No whiplash.",
    "  BACKGROUNDS:",
    "  • backgroundQuery: 2–4 literal visual-search keywords when stock media helps (place, object, atmosphere). Never return a URL, provider id, or asset id.",
    mediaIntentRule,
    `  • Use backgroundQuery on ~30–50% of scenes. ${photoOmit}`,
    "  • effect: ken-burns|pan-left|pan-right|pan-up|pan-down — vary gently; ken-burns for hero beats.",
    `  • Stock media crops to ${aspect} — choose subjects that read in that frame.`,
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
      ? `\n\nExisting scenes and lock state for context:\n${input.existingContext}`
      : "";
    const positions = input.replacementSceneNumbers?.length
      ? ` Replace only scene positions ${input.replacementSceneNumbers.join(", ")} and return exactly ${input.replacementSceneNumbers.length} replacement scenes in that order.`
      : "";
    user = `Rewrite the requested parts of this short video to feel more personal and clear.${positions} Preserve supplied facts and keep the tone professional and soothing.\n\nTopic: ${input.brief}${ctx}`;
  } else if (input.mode === "hook_variants") {
    const ctx = input.existingContext
      ? `\n\nCurrent opening for context:\n${input.existingContext}`
      : "";
    user = `Create three materially different opening options for this video. Use a direct benefit, a useful question, and a source-grounded observation. Do not invent claims or repeat the same sentence pattern.\n\nTopic: ${input.brief}${ctx}`;
  } else {
    const startNum =
      input.existingSceneCount != null ? input.existingSceneCount + 1 : "next";
    const ctx = input.existingContext
      ? `\n\nExisting scenes (do NOT repeat these):\n${input.existingContext}`
      : "";
    user = input.chapterTitle
      ? `Append a new chapter titled ${JSON.stringify(input.chapterTitle)}, starting at scene ${startNum}, to this video. Build one small arc: introduce the chapter, explain the supplied topic, then resolve its takeaway. Use fresh value and preserve supplied facts. Do not rewrite earlier chapters or add a whole-video intro or CTA.${ctx}\n\nFocus: ${input.brief}`
      : `Add scenes ${startNum}+ to a short video that already has ${input.existingSceneCount ?? "several"} scenes.\n\nRules:\n- Fresh value only.\n- No CTA (the video already ends with one).\n- Start with a curiosity gap that still feels kind and clear.${ctx}\n\nFocus: ${input.brief}`;
  }

  return { system, user };
}
