/**
 * Shared humanisation + structure rules for podcast scripts — used by in-app AI
 * generation and the copyable external-AI JSON prompt.
 */
export const PODCAST_HUMANISE_RULES = [
  "Write like real people on a mic: natural rhythm, reactions, warmth, curiosity, and clear emotion.",
  "Humanise every line with feelings, tone shifts, and spoken texture — excitement, doubt, empathy, humour, wonder — through the WORDS themselves.",
  "Suggest pace and pauses in language only: short punchy lines for energy; longer reflective sentences when thoughtful; use '…' sparingly for a breath (never spam).",
  "Light conversational glue is good: 'you know', 'honestly', 'wait —', 'right?', 'I mean' — but do not overdo filler.",
  "Each character should sound distinct: different energy, vocabulary, and emotional colour matching their role.",
  "Use character NAMES in dialogue when it feels natural (greetings, call-outs, hand-offs) so the episode feels personal.",
  "NEVER put stage directions like [laughs], (pause), *sigh*, or (softly) — TTS will read them aloud. Convey expression in spoken wording.",
  "NEVER use markdown, asterisks for emphasis, or emoji in turn text.",
].join("\n");

/** Mandatory open + close structure for every podcast script. */
export const PODCAST_STRUCTURE_RULES = [
  "OPENING (mandatory): The first 1–2 turns MUST be the host introducing the panel by name and the episode topic. Welcome the listener, name each guest briefly, and state what today's conversation is about.",
  "ENDING (mandatory): The last 1–2 turns MUST be a closing note from the host (or primary host): thank the guest(s) by name, one soft takeaway, and a warm goodbye. Do not end mid-debate.",
  "Middle turns are the conversation. Alternate speakers; keep energy human.",
].join("\n");

export function buildPodcastHumaniseBlock(
  prefix = "HUMAN VOICE (mandatory):",
): string {
  return `${prefix}\n${PODCAST_HUMANISE_RULES.split("\n")
    .map((l) => `- ${l}`)
    .join("\n")}`;
}

export function buildPodcastStructureBlock(
  prefix = "EPISODE STRUCTURE (mandatory):",
): string {
  return `${prefix}\n${PODCAST_STRUCTURE_RULES.split("\n")
    .map((l) => `- ${l}`)
    .join("\n")}`;
}
