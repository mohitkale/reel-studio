import { describe, expect, it } from "vitest";

import { podcastPlanSchema } from "@/library/podcast-schemas";
import { normalizePodcastPlan } from "@/providers/ai/podcast-types";
import { PODCAST_HUMANISE_RULES } from "@/providers/ai/podcast-humanise";
import { buildPodcastPrompt } from "@/providers/ai/podcast-prompt";
import { buildPodcastJsonPrompt } from "@/components/podcasts/podcast-json-prompt";
import { stitchBeats } from "@/lib/audio-timing";
import { makeSilentWav } from "@/lib/wav";

describe("podcastPlanSchema", () => {
  it("accepts a valid multi-speaker plan", () => {
    const plan = podcastPlanSchema.parse({
      title: "Test",
      characters: [
        { id: "host", name: "Alex", gender: "male" },
        { id: "guest", name: "Sam", gender: "female" },
      ],
      turns: [
        { characterId: "host", text: "Hey — glad you're here." },
        { characterId: "guest", text: "Me too. Where do we start?" },
      ],
    });
    expect(plan.turns).toHaveLength(2);
  });

  it("rejects turns with unknown character ids", () => {
    const result = podcastPlanSchema.safeParse({
      characters: [
        { id: "host", name: "Alex", gender: "male" },
        { id: "guest", name: "Sam", gender: "female" },
      ],
      turns: [{ characterId: "narrator", text: "Nope" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizePodcastPlan", () => {
  it("maps character ids onto the configured cast", () => {
    const plan = normalizePodcastPlan(
      {
        turns: [
          { characterId: "HOST", text: "Hello there" },
          { characterId: "guest", text: "Hi back" },
        ],
      },
      [
        { key: "host", name: "Alex", gender: "male" },
        { key: "guest", name: "Sam", gender: "female" },
      ],
    );
    expect(plan.turns[0].characterId).toBe("host");
    expect(plan.characters.map((c) => c.id)).toEqual(["host", "guest"]);
  });
});

describe("podcast humanisation prompts", () => {
  it("embeds humanise and structure rules in AI and JSON prompts", () => {
    const cast = [
      { key: "maya", name: "Maya", gender: "female" },
      { key: "jordan", name: "Jordan", gender: "male" },
    ];
    const { system } = buildPodcastPrompt({
      brief: "Why rest matters",
      length: "short",
      characters: cast,
    });
    expect(system).toContain("Humanise");
    expect(system).toContain("OPENING");
    expect(system).toContain("ENDING");
    expect(PODCAST_HUMANISE_RULES.length).toBeGreaterThan(40);
    expect(system).toContain("stage directions");

    const jsonPrompt = buildPodcastJsonPrompt(
      cast.map((c, order) => ({
        id: `c${order}`,
        podcastId: "p1",
        key: c.key,
        name: c.name,
        gender: c.gender as "male" | "female",
        definition: "",
        providerId: "",
        voiceId: "",
        modelId: null,
        order,
      })),
      "short",
    );
    expect(jsonPrompt).toContain("HUMAN VOICE");
    expect(jsonPrompt).toContain("EPISODE STRUCTURE");
    expect(jsonPrompt).toContain("maya");
    expect(jsonPrompt).toContain("jordan");
  });
});

describe("podcast stitch order", () => {
  it("preserves turn order when stitching concurrent results", () => {
    const beats = [
      { sceneId: "t0", text: "first", wav: makeSilentWav(0.5) },
      { sceneId: "t1", text: "second", wav: makeSilentWav(0.5) },
      { sceneId: "t2", text: "third", wav: makeSilentWav(0.5) },
    ];
    const stitched = stitchBeats(beats, 30);
    expect(stitched.timeline.map((b) => b.sceneId)).toEqual([
      "t0",
      "t1",
      "t2",
    ]);
    expect(stitched.timeline[0].startFrame).toBe(0);
    expect(stitched.timeline[1].startFrame).toBeGreaterThan(
      stitched.timeline[0].startFrame,
    );
  });
});
