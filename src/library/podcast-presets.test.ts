import { describe, expect, it } from "vitest";

import {
  derivePodcastChapters,
  PODCAST_PRESETS,
  resolvePodcastPreset,
} from "@/library/podcast-presets";
import { podcastPlanSchema } from "@/library/podcast-schemas";
import { buildPodcastPrompt } from "@/providers/ai/podcast-prompt";

describe("podcast production presets", () => {
  it("ships solo, discussion and interview formats with distinct direction", () => {
    expect(Object.keys(PODCAST_PRESETS)).toEqual([
      "solo-narration",
      "two-host-discussion",
      "interview",
    ]);
    expect(PODCAST_PRESETS["solo-narration"].cast).toHaveLength(1);
    expect(PODCAST_PRESETS.interview.direction).toContain("guest");
    expect(resolvePodcastPreset("legacy-value").id).toBe("two-host-discussion");
  });

  it("accepts a solo script and tells AI not to invent speakers", () => {
    expect(
      podcastPlanSchema.parse({
        characters: [{ id: "narrator", name: "Narrator" }],
        turns: [
          { characterId: "narrator", text: "First idea." },
          { characterId: "narrator", text: "Second idea." },
        ],
      }).characters,
    ).toHaveLength(1);
    const prompt = buildPodcastPrompt({
      brief: "A useful lesson",
      length: "short",
      presetId: "solo-narration",
      characters: [{ key: "narrator", name: "Narrator", gender: "neutral" }],
    });
    expect(prompt.system).toContain("Do not invent a guest");
    expect(prompt.user).not.toContain("today I'm joined by");
  });

  it("derives chapter titles and boundaries only from timed turns", () => {
    const timeline = Array.from({ length: 13 }, (_, index) => ({
      turnId: `turn-${index + 1}`,
      startFrame: index * 450,
      durationFrames: 300,
      text:
        index === 6
          ? "The practical workflow starts here."
          : `Beat ${index + 1}`,
      characterKey: "host",
    }));
    const chapters = derivePodcastChapters(timeline, 30);
    expect(chapters).toHaveLength(3);
    expect(chapters[0]).toMatchObject({
      title: "Opening",
      startTurnId: "turn-1",
      endTurnId: "turn-6",
    });
    expect(chapters[1].title).toBe("The practical workflow starts here");
    expect(chapters[2].endTurnId).toBe("turn-13");
  });
});
