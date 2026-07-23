/**
 * Deterministic, redistributable demo content for open-source launch assets.
 * Synthetic copy only — no personal data, brands, or cloud API requirements.
 */

export const DEMO_VIDEO_PROJECT_NAME = "Content Creation in 30 Seconds";
export const DEMO_VIDEO_SCRIPT_NAME = "Ship your next short";

/** Three HyperFrames scenes: opener → statement → CTA. */
export const DEMO_VIDEO_SCENES = [
  {
    templateId: "hf-opener",
    text: "Great content starts with one clear idea.",
    spokenText:
      "Great content starts with one clear idea. Not ten tabs. One idea.",
    emphasis: ["one clear idea"],
  },
  {
    templateId: "hf-statement",
    text: "Write it. Record it. Ship it today.",
    spokenText:
      "Write a short script, record a voice take, and ship it today.",
    emphasis: ["Ship it today"],
  },
  {
    templateId: "hf-cta",
    text: "Create your next short in Reel Studio.",
    spokenText: "Create your next short in Reel Studio. Local, open source, yours.",
    visual: "Start free",
    emphasis: ["Reel Studio"],
  },
] as const;

export const DEMO_PODCAST_TITLE = "Content Creation Tips";
export const DEMO_PODCAST_DESCRIPTION =
  "A 60-second conversation on shipping short-form content without overthinking.";

/** Short dialogue — character keys match the default Maya / Jordan cast. */
export const DEMO_PODCAST_TURNS = [
  {
    characterId: "maya",
    text: "Jordan, what's the fastest way to ship a short this week?",
  },
  {
    characterId: "jordan",
    text: "Pick one idea. Write three lines. Record once. Don't chase perfect.",
  },
  {
    characterId: "maya",
    text: "And if you're stuck on tools?",
  },
  {
    characterId: "jordan",
    text: "Use a local studio, keep projects on your machine, and hit export.",
  },
] as const;
