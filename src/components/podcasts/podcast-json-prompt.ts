import type { PodcastCharacterDTO, PodcastLengthDTO } from "@/lib/dto";
import {
  buildPodcastHumaniseBlock,
  buildPodcastStructureBlock,
} from "@/providers/ai/podcast-humanise";

/** Character-aware external-AI prompt (mirrors storyboard JSON dialog). */
export function buildPodcastJsonPrompt(
  characters: PodcastCharacterDTO[],
  length: PodcastLengthDTO,
): string {
  const durationHint =
    length === "long"
      ? "5 to 10 minutes when spoken (~750 to 1500 words total)"
      : "2 to 3 minutes when spoken (~300 to 450 words total)";
  const turnHint =
    length === "long" ? "About 24 to 60 turns." : "About 12 to 28 turns.";

  const host =
    characters.find((c) => /host/i.test(c.key) || /host/i.test(c.name)) ??
    characters[0];
  const guest =
    characters.find((c) => c.id !== host?.id) ?? characters[1] ?? characters[0];

  const cast = characters.map((c) => ({
    id: c.key,
    name: c.name,
    gender: c.gender,
  }));

  const sampleTurns = [
    {
      characterId: host?.key ?? "host",
      text: `Hey everyone — welcome in. I'm ${host?.name ?? "the host"}, and today I'm joined by ${guest?.name ?? "my guest"}. We're diving into something I've been sitting with…`,
    },
    {
      characterId: guest?.key ?? "guest",
      text: `Thanks ${host?.name ?? "host"} — glad to be here. Where do you want to start?`,
    },
    {
      characterId: host?.key ?? "host",
      text: `…and that's our wrap. ${guest?.name ?? "Friend"}, thank you so much. Take care out there.`,
    },
  ];

  const sample = JSON.stringify(
    {
      title: "Episode title",
      description: "One sentence summary of the conversation",
      characters: cast,
      turns: sampleTurns,
    },
    null,
    2,
  );

  const castLines = characters
    .map((c) => {
      const role =
        host && c.key === host.key ? " — PRIMARY HOST (opens and closes)" : "";
      const def = c.definition?.trim()
        ? `\n  Character definition: ${c.definition.trim()}`
        : "";
      return `- id "${c.key}": name "${c.name}" (${c.gender})${role}. Use this exact id. Other speakers should say "${c.name}" when addressing them.${def}`;
    })
    .join("\n");

  return `You are writing a voice-only podcast script as JSON for "Reel Studio".

Output ONLY a JSON object (no markdown fences, no commentary).

${buildPodcastHumaniseBlock()}

${buildPodcastStructureBlock()}

CAST (use these exact character ids and names — do not invent new speakers):
${castLines}

LENGTH: ${length} — target ${durationHint}. ${turnHint}

FIELD GUIDE:
- "title" (optional): short episode title
- "description" (optional): 1–2 sentence summary
- "characters": copy the cast above (same ids/names/genders)
- "turns": ordered dialogue. Each item:
  • "characterId" (required): one of the cast ids
  • "text" (required): spoken words only. 1–3 sentences. Plain English. No stage directions.
  • Use real names in the dialogue for a personal feel.

STORY RULES:
- First turns: host introduces the panel BY NAME and the topic.
- Last turns: host closing note, thank guests BY NAME, warm goodbye.
- Sequence matters — turns are spoken in array order.

Example of the exact output shape:
${sample}

Now write the JSON object for this podcast:
TOPIC: <replace with your podcast idea, audience, and tone>`;
}

export function buildSamplePodcastJson(
  characters: PodcastCharacterDTO[],
): string {
  const host =
    characters.find((c) => /host/i.test(c.key) || /host/i.test(c.name)) ??
    characters[0];
  const guest =
    characters.find((c) => c.id !== host?.id) ?? characters[1] ?? characters[0];
  return JSON.stringify(
    {
      title: "Untitled episode",
      description: "",
      characters: characters.map((c) => ({
        id: c.key,
        name: c.name,
        gender: c.gender,
      })),
      turns: [
        {
          characterId: host?.key ?? "host",
          text: `Hey everyone — welcome in. I'm ${host?.name ?? "the host"}, and today I'm joined by ${guest?.name ?? "my guest"}.`,
        },
        {
          characterId: guest?.key ?? "guest",
          text: `Thanks ${host?.name ?? "host"} — glad to be here.`,
        },
        {
          characterId: host?.key ?? "host",
          text: `That's a wrap. ${guest?.name ?? "Friend"}, thank you. Take care.`,
        },
      ],
    },
    null,
    2,
  );
}
