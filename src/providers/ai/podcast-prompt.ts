import type { GeneratePodcastPlanInput } from "./podcast-types";
import {
  buildPodcastHumaniseBlock,
  buildPodcastStructureBlock,
} from "./podcast-humanise";

/**
 * Director prompt for multi-speaker audio podcasts.
 * Emphasizes natural conversation, human nuance, intro/outro, and duration.
 */
export function buildPodcastPrompt(input: GeneratePodcastPlanInput): {
  system: string;
  user: string;
} {
  const isLong = input.length === "long";
  const durationHint = isLong
    ? "5 to 10 minutes when spoken (~750 to 1500 words of dialogue total)"
    : "2 to 3 minutes when spoken (~300 to 450 words of dialogue total)";
  const turnHint = isLong
    ? "About 24 to 60 turns. Alternate speakers naturally; occasional longer monologues are fine."
    : "About 12 to 28 turns for a normal short episode. For a very short demo, still include a real intro + a few beats + closing (minimum ~8 turns).";

  const host =
    input.characters.find((c) => /host/i.test(c.key) || /host/i.test(c.name)) ??
    input.characters[0];
  const castLines = input.characters
    .map((c) => {
      const role =
        host && c.key === host.key ? " — PRIMARY HOST (opens and closes)" : "";
      const def = c.definition?.trim()
        ? `\n  Character definition: ${c.definition.trim()}`
        : "";
      return `- id "${c.key}": name "${c.name}" (${c.gender})${role}. Use this exact id in every turn's characterId. Other speakers should say this name when addressing them.${def}`;
    })
    .join("\n");

  const system = [
    "You write voice-only podcast scripts as JSON for Reel Studio.",
    "This is audio only — no visuals, no scene templates, no on-screen text.",
    buildPodcastHumaniseBlock(),
    buildPodcastStructureBlock(),
    `Target length: ${durationHint}.`,
    turnHint,
    "Rules:",
    "- Output ONLY valid JSON matching the schema (no markdown fences, no commentary).",
    "- Every turn.characterId MUST be one of the provided character ids.",
    "- Characters array in the output MUST use the same ids/names/genders provided (do not invent new speakers).",
    "- Write each speaker in a voice that matches their Character definition (tone, energy, vocabulary) when provided.",
    "- Opening turns: host greets listeners, introduces co-hosts/guests BY NAME, and frames the topic.",
    "- Closing turns: host thanks guests BY NAME and signs off warmly.",
    "- Alternate speakers most of the time; avoid one person dominating more than ~3 turns in a row unless storytelling.",
    "- Each turn is one spoken beat (1–3 sentences). Prefer short turns for energy; let a turn breathe when the feeling needs it.",
    "- title (optional): short episode title. description (optional): 1–2 sentence summary.",
  ].join("\n");

  const guest =
    input.characters.find((c) => c.key !== host?.key) ?? input.characters[1];

  const user = [
    "CAST (use these exact character ids and names):",
    castLines,
    "",
    `Length mode: ${input.length} (${durationHint}).`,
    "",
    "TOPIC / BRIEF:",
    input.brief.trim(),
    "",
    "Return JSON shaped like:",
    JSON.stringify(
      {
        title: "Episode title",
        description: "One sentence summary",
        characters: input.characters.map((c) => ({
          id: c.key,
          name: c.name,
          gender: c.gender,
        })),
        turns: [
          {
            characterId: host?.key ?? "host",
            text: `Hey everyone — welcome in. I'm ${host?.name ?? "the host"}, and today I'm joined by ${guest?.name ?? "my guest"}. We're talking about…`,
          },
          {
            characterId: guest?.key ?? "guest",
            text: `Thanks ${host?.name ?? "host"} — glad to be here.`,
          },
          {
            characterId: host?.key ?? "host",
            text: `…and that's a wrap. ${guest?.name ?? "Friend"}, thank you. Listeners — take care.`,
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");

  return { system, user };
}
