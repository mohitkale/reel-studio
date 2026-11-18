import type { StoryboardBrief } from "@/providers/ai/storyboard-prompt";

/**
 * Twelve briefs, one for each golden example in `examples/storyboards`, so a
 * writer model can be judged on the same range of videos the examples show.
 * `npm run benchmark:writers` writes each one with a model and lints the result.
 */
export interface BenchmarkBrief {
  /** The golden example this brief matches. */
  example: string;
  brief: StoryboardBrief;
}

export const BENCHMARK_BRIEFS: readonly BenchmarkBrief[] = [
  {
    example: "explainer",
    brief: {
      topic: "How noise-cancelling headphones work",
      format: "16:9",
      targetSeconds: 45,
    },
  },
  {
    example: "how-to",
    brief: {
      topic: "Better pour-over coffee at home in five steps",
      format: "9:16",
      targetSeconds: 40,
    },
  },
  {
    example: "listicle",
    brief: {
      topic: "Five Excel shortcuts worth learning",
      format: "9:16",
      targetSeconds: 35,
    },
  },
  {
    example: "comparison",
    brief: {
      topic: "Cast iron or nonstick: which pan for which job",
      format: "16:9",
      targetSeconds: 40,
    },
  },
  {
    example: "data-story",
    brief: {
      topic:
        "World population passed eight billion: 2.5 billion in 1950, 4 billion in 1974, 6 billion in 1999, 8 billion in 2022",
      format: "1:1",
      targetSeconds: 40,
    },
  },
  {
    example: "developer-demo",
    brief: {
      topic: "Debounce a search box in six lines of JavaScript",
      audience: "web developers",
      format: "16:9",
      targetSeconds: 40,
    },
  },
  {
    example: "motivation",
    brief: {
      topic: "Start before you feel ready",
      tone: "warm and encouraging",
      format: "9:16",
      targetSeconds: 30,
    },
  },
  {
    example: "myth-vs-fact",
    brief: {
      topic: "Three common health myths, busted",
      format: "9:16",
      targetSeconds: 40,
    },
  },
  {
    example: "news-recap",
    brief: {
      topic:
        "Recap of the Artemis I mission: launched November 2022, flew around the Moon, returned in December 2022",
      format: "16:9",
      targetSeconds: 45,
    },
  },
  {
    example: "product-launch",
    brief: {
      topic:
        "A launch teaser for Brim, a water bottle that stays cold for 24 hours",
      format: "9:16",
      targetSeconds: 30,
    },
  },
  {
    example: "story",
    brief: {
      topic: "A lighthouse keeper's last winter before the light is automated",
      tone: "quiet and reflective",
      format: "9:16",
      targetSeconds: 45,
    },
  },
  {
    example: "podcast",
    brief: {
      kind: "podcast",
      topic: "Is a four-day work week worth it?",
      hosts: 2,
      targetSeconds: 120,
    },
  },
];
