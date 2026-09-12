import type { PodcastDTO, PodcastTakeDTO } from "@/lib/dto";

function timestamp(frame: number, fps: number): string {
  const totalSeconds = Math.max(0, Math.floor(frame / Math.max(1, fps)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function podcastTranscriptText(
  podcast: Pick<PodcastDTO, "title" | "characters">,
  take: PodcastTakeDTO,
): string {
  const names = new Map(
    podcast.characters.map((character) => [character.key, character.name]),
  );
  const lines = [podcast.title, ""];
  for (const beat of take.timeline) {
    const speaker =
      names.get(beat.characterKey ?? "") ?? beat.characterKey ?? "Speaker";
    lines.push(`[${timestamp(beat.startFrame, take.fps)}] ${speaker}`);
    lines.push(beat.text, "");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function podcastChaptersJson(take: PodcastTakeDTO): string {
  return `${JSON.stringify(
    {
      version: 1,
      fps: take.fps,
      durationFrames: take.totalFrames,
      chapters: take.chapters.map((chapter) => ({
        ...chapter,
        startSeconds: chapter.startFrame / take.fps,
        endSeconds: chapter.endFrame / take.fps,
      })),
    },
    null,
    2,
  )}\n`;
}
