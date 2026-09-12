import { z } from "zod";

import type { PodcastBeatTimingDTO, PodcastChapterDTO } from "@/lib/dto";

export const PODCAST_PRESET_IDS = [
  "solo-narration",
  "two-host-discussion",
  "interview",
] as const;

export const podcastPresetIdSchema = z.enum(PODCAST_PRESET_IDS);
export type PodcastPresetId = z.infer<typeof podcastPresetIdSchema>;

export interface PodcastPresetDefinition {
  id: PodcastPresetId;
  label: string;
  description: string;
  direction: string;
  pacing: { sameSpeakerGapSeconds: number; speakerChangeGapSeconds: number };
  cast: Array<{
    key: string;
    name: string;
    gender: "male" | "female" | "neutral";
    definition: string;
  }>;
  audiogram: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
  };
}

export const PODCAST_PRESETS: Record<PodcastPresetId, PodcastPresetDefinition> =
  {
    "solo-narration": {
      id: "solo-narration",
      label: "Solo narration",
      description:
        "A focused monologue for lessons, stories, and audio essays.",
      direction:
        "One narrator carries the episode. Use clear sections, varied sentence length, and natural transitions without pretending another speaker is present.",
      pacing: { sameSpeakerGapSeconds: 0.65, speakerChangeGapSeconds: 0.65 },
      cast: [
        {
          key: "narrator",
          name: "Narrator",
          gender: "neutral",
          definition:
            "Clear, warm solo narrator. Sounds considered and conversational, with purposeful pauses between ideas.",
        },
      ],
      audiogram: {
        background: "#111827",
        foreground: "#F9FAFB",
        accent: "#22D3EE",
        muted: "#94A3B8",
      },
    },
    "two-host-discussion": {
      id: "two-host-discussion",
      label: "Two-host discussion",
      description:
        "A quick, natural exchange with complementary points of view.",
      direction:
        "Two hosts share the episode. Alternate naturally, allow short reactions, and make each voice add a distinct perspective.",
      pacing: { sameSpeakerGapSeconds: 0.4, speakerChangeGapSeconds: 0.7 },
      cast: [
        {
          key: "maya",
          name: "Maya",
          gender: "female",
          definition:
            "Warm primary host. Curious, clear, invites the co-host in by name, and keeps the episode moving.",
        },
        {
          key: "jordan",
          name: "Jordan",
          gender: "male",
          definition:
            "Thoughtful co-host. Uses practical examples, grounded reactions, and friendly pushback.",
        },
      ],
      audiogram: {
        background: "#0F172A",
        foreground: "#F8FAFC",
        accent: "#A78BFA",
        muted: "#94A3B8",
      },
    },
    interview: {
      id: "interview",
      label: "Interview",
      description:
        "A host-led conversation that keeps the guest and their ideas central.",
      direction:
        "The host asks concise, specific questions and follows up on the guest's answers. The guest supplies the substantive stories and examples.",
      pacing: { sameSpeakerGapSeconds: 0.5, speakerChangeGapSeconds: 0.9 },
      cast: [
        {
          key: "host",
          name: "Host",
          gender: "neutral",
          definition:
            "Prepared, concise interviewer. Frames the subject, asks one question at a time, and follows up on specific details.",
        },
        {
          key: "guest",
          name: "Guest",
          gender: "neutral",
          definition:
            "Subject-matter guest. Gives concrete answers, examples, and useful nuance without sounding rehearsed.",
        },
      ],
      audiogram: {
        background: "#1C1917",
        foreground: "#FAFAF9",
        accent: "#FB923C",
        muted: "#A8A29E",
      },
    },
  };

export const DEFAULT_PODCAST_PRESET: PodcastPresetId = "two-host-discussion";

export function resolvePodcastPreset(raw: string): PodcastPresetDefinition {
  const parsed = podcastPresetIdSchema.safeParse(raw);
  return PODCAST_PRESETS[parsed.success ? parsed.data : DEFAULT_PODCAST_PRESET];
}

function chapterTitle(text: string, index: number): string {
  if (index === 0) return "Opening";
  const firstSentence = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  const words = firstSentence.replace(/\s+/g, " ").split(" ").filter(Boolean);
  const candidate = words
    .slice(0, 7)
    .join(" ")
    .replace(/[.,:;!?]+$/, "");
  return candidate || `Chapter ${index + 1}`;
}

/** Build stable chapter boundaries from actual turn timing; no topic is invented. */
export function derivePodcastChapters(
  timeline: PodcastBeatTimingDTO[],
  fps: number,
): PodcastChapterDTO[] {
  if (timeline.length === 0) return [];
  const targetFrames = Math.max(1, fps) * 75;
  const starts = [0];
  let lastStartFrame = timeline[0].startFrame;
  for (let i = 1; i < timeline.length; i += 1) {
    const enoughTime = timeline[i].startFrame - lastStartFrame >= targetFrames;
    const enoughTurns = i - starts[starts.length - 1] >= 6;
    if (enoughTime && enoughTurns) {
      starts.push(i);
      lastStartFrame = timeline[i].startFrame;
    }
  }

  return starts.map((timelineIndex, chapterIndex) => {
    const first = timeline[timelineIndex];
    const nextStart = starts[chapterIndex + 1];
    const last = timeline[(nextStart ?? timeline.length) - 1];
    return {
      id: `chapter-${chapterIndex + 1}`,
      title: chapterTitle(first.text, chapterIndex),
      startFrame: first.startFrame,
      endFrame: last.startFrame + last.durationFrames,
      startTurnId: first.turnId,
      endTurnId: last.turnId,
    };
  });
}
