import { z } from "zod";

import type { PodcastTakeDTO } from "@/lib/dto";

export const podcastClipSuggestionCandidateSchema = z
  .object({
    startTurnId: z.string().min(1),
    endTurnId: z.string().min(1),
    label: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

export const podcastClipSuggestionCandidatesSchema = z
  .object({
    suggestions: z.array(podcastClipSuggestionCandidateSchema).min(1).max(5),
  })
  .strict();

export type PodcastClipSuggestionCandidate = z.infer<
  typeof podcastClipSuggestionCandidateSchema
>;

export interface GeneratePodcastClipSuggestionsInput {
  modelId?: string;
  title: string;
  fps: number;
  timeline: Array<{
    turnId: string;
    startFrame: number;
    durationFrames: number;
    characterKey?: string;
    text: string;
  }>;
}

export function buildPodcastClipSuggestionsPrompt(
  input: GeneratePodcastClipSuggestionsInput,
): { system: string; user: string } {
  const transcript = input.timeline
    .map((beat) => {
      const start = (beat.startFrame / input.fps).toFixed(2);
      const end = ((beat.startFrame + beat.durationFrames) / input.fps).toFixed(
        2,
      );
      return `[${beat.turnId}] ${start}-${end}s ${beat.characterKey ?? "Speaker"}: ${beat.text}`;
    })
    .join("\n");
  return {
    system:
      "Select up to five compelling contiguous podcast clips. Return only existing start and end turn IDs. Do not write or paraphrase quotes; the application derives all displayed copy from the immutable transcript. Each range must be 1 to 90 seconds and the end must follow the start.",
    user: `Podcast: ${input.title}\n\nTimestamped transcript:\n${transcript}`,
  };
}

export function groundPodcastClipSuggestions(
  take: PodcastTakeDTO,
  candidates: readonly PodcastClipSuggestionCandidate[],
) {
  const seen = new Set<string>();
  return candidates.map((candidate) => {
    const startIndex = take.timeline.findIndex(
      (beat) => beat.turnId === candidate.startTurnId,
    );
    const endIndex = take.timeline.findIndex(
      (beat) => beat.turnId === candidate.endTurnId,
    );
    if (startIndex < 0 || endIndex < 0) {
      throw new Error("Clip suggestion references a turn outside this take");
    }
    if (endIndex < startIndex) {
      throw new Error("Clip suggestion end must follow its start turn");
    }
    const key = `${candidate.startTurnId}:${candidate.endTurnId}`;
    if (seen.has(key)) throw new Error("Clip suggestions must be distinct");
    seen.add(key);
    const selected = take.timeline.slice(startIndex, endIndex + 1);
    const first = selected[0];
    const last = selected[selected.length - 1];
    const startSeconds = first.startFrame / Math.max(1, take.fps);
    const endSeconds =
      (last.startFrame + last.durationFrames) / Math.max(1, take.fps);
    const durationSeconds = endSeconds - startSeconds;
    if (durationSeconds < 1 || durationSeconds > 90) {
      throw new Error("Clip suggestion must be between 1 and 90 seconds");
    }
    return {
      ...candidate,
      startSeconds,
      endSeconds,
      durationSeconds,
      selectedTurnIds: selected.map((beat) => beat.turnId),
      quote: selected.map((beat) => beat.text).join(" "),
    };
  });
}

/** Local suggestions keep manual clip selection useful with no AI configured. */
export function deterministicPodcastClipSuggestions(take: PodcastTakeDTO) {
  if (!take.timeline.length) return [];
  const starts = [
    0,
    Math.floor(take.timeline.length / 3),
    Math.floor((take.timeline.length * 2) / 3),
  ];
  const candidates: PodcastClipSuggestionCandidate[] = [];
  for (const [slot, startIndex] of starts.entries()) {
    let endIndex = startIndex;
    while (endIndex + 1 < take.timeline.length) {
      const first = take.timeline[startIndex];
      const next = take.timeline[endIndex + 1];
      const seconds =
        (next.startFrame + next.durationFrames - first.startFrame) /
        Math.max(1, take.fps);
      if (seconds > 45) break;
      endIndex += 1;
      if (seconds >= 15) break;
    }
    const first = take.timeline[startIndex];
    const last = take.timeline[endIndex];
    const durationSeconds =
      (last.startFrame + last.durationFrames - first.startFrame) /
      Math.max(1, take.fps);
    if (durationSeconds < 1 || durationSeconds > 90) continue;
    candidates.push({
      startTurnId: take.timeline[startIndex].turnId,
      endTurnId: take.timeline[endIndex].turnId,
      label: ["Opening moment", "Core insight", "Closing moment"][slot],
      reason: "A timestamp-grounded range from this saved take.",
    });
  }
  const unique = candidates.filter(
    (candidate, index, all) =>
      all.findIndex(
        (item) =>
          item.startTurnId === candidate.startTurnId &&
          item.endTurnId === candidate.endTurnId,
      ) === index,
  );
  return groundPodcastClipSuggestions(take, unique);
}
