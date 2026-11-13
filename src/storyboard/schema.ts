/**
 * Storyboard v1: the single public contract between a writer (an LLM, a coding
 * agent or a person) and Reel Studio. It is the only thing a model writes.
 * Layout, motion, colour, transitions and timing are decided locally and
 * deterministically from it.
 *
 * Versioning: additive changes (new optional fields, new scene types) keep
 * `version: 1`. Anything breaking becomes `version: 2` with a converter.
 *
 * Every `.describe()` is written for a model: what the field is, its limit and
 * an example. Limits are enforced here, not by prompt text.
 */
import { z } from "zod";

export const STORYBOARD_VERSION = 1 as const;

export const STORYBOARD_LIMITS = {
  title: 80,
  headline: 60,
  narration: 400,
  body: 200,
  itemCount: { min: 2, max: 6 },
  item: 60,
  statValue: 12,
  statLabel: 40,
  chartLabels: { min: 2, max: 6 },
  chartSeries: { min: 1, max: 3 },
  chartLabel: 24,
  chartUnit: 8,
  chartSource: 80,
  quoteText: 160,
  quoteAttribution: 60,
  codeText: 600,
  codeLines: 12,
  mediaQuery: 80,
  mediaPath: 200,
  icon: 40,
  emphasisCount: 3,
  emphasisWord: 24,
  durationHint: { min: 2, max: 30 },
  scenes: { min: 1, max: 40 },
  sources: 12,
  sourceTitle: 120,
  speakers: { min: 1, max: 3 },
  speakerName: 40,
  turns: { min: 1, max: 80 },
  turnText: 600,
} as const;

const L = STORYBOARD_LIMITS;

/** Scene types v1 can write. Later releases add types without a version bump. */
export const SCENE_TYPES = [
  "hook",
  "statement",
  "list",
  "stat",
  "chart",
  "quote",
  "code",
  "media",
  "cta",
] as const;
export const sceneTypeSchema = z
  .enum(SCENE_TYPES)
  .describe(
    'What the scene is. hook: opening line that grabs attention. statement: one key idea. list: 2-6 short points (needs items). stat: one big number (needs stat). chart: compare values (needs chart). quote: a quotation (needs quote). code: a code snippet (needs code). media: a picture or clip carries the scene (needs media). cta: closing call to action. Example: "statement".',
  );

export const FORMATS = ["9:16", "16:9", "1:1"] as const;
export const formatSchema = z
  .enum(FORMATS)
  .describe(
    'Canvas shape. "9:16" vertical for Reels, Shorts and TikTok; "16:9" landscape for YouTube; "1:1" square. Default "9:16".',
  );

const slug = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,39}$/,
    "Use lowercase letters, digits and hyphens",
  );

export const voiceSchema = z
  .strictObject({
    enabled: z
      .boolean()
      .default(true)
      .describe("Narrate the video with a local voice. Default true."),
    voiceId: z
      .string()
      .min(1)
      .max(60)
      .optional()
      .describe(
        'Voice name from the voice list, for example "af_heart". Omit to use the default voice.',
      ),
    speed: z
      .number()
      .min(0.7)
      .max(1.3)
      .optional()
      .describe("Speaking speed, 0.7 to 1.3. Omit for natural speed (1.0)."),
  })
  .describe("Narration settings. Omit to narrate with the default voice.");

export const musicSchema = z
  .union([z.literal("auto"), z.literal("none"), slug])
  .describe(
    'Background music. "auto" picks a fitting bundled track, "none" for silence, or a track id. Default "auto".',
  );

export const captionsSchema = z
  .enum(["auto", "off"])
  .describe(
    'Captions generated from the narration. "auto" shows them, "off" hides them. Default "auto".',
  );

export const sourceSchema = z.strictObject({
  title: z
    .string()
    .min(1)
    .max(L.sourceTitle)
    .describe('Title of the page or document. Example: "WHO sleep guidance".'),
  url: z
    .url({ protocol: /^https?$/, hostname: z.regexes.domain })
    .describe("Public http(s) address of the source."),
  accessed: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .describe('Date you read it, YYYY-MM-DD. Example: "2026-11-13".'),
});

const textLine = (max: number, what: string) =>
  z.string().trim().min(1).max(max).describe(what);

export const chartSchema = z
  .strictObject({
    labels: z
      .array(textLine(L.chartLabel, "One category label."))
      .min(L.chartLabels.min)
      .max(L.chartLabels.max)
      .describe(
        'Category labels along the axis. Example: ["2023", "2024", "2025"].',
      ),
    series: z
      .array(
        z.strictObject({
          label: textLine(
            L.chartLabel,
            'Name of this data series. Example: "Users".',
          ),
          values: z
            .array(z.number().finite())
            .min(L.chartLabels.min)
            .max(L.chartLabels.max)
            .describe(
              "One number per label, in the same order. Use real figures only.",
            ),
          unit: z
            .string()
            .max(L.chartUnit)
            .optional()
            .describe('Unit shown with the numbers, for example "%" or "k".'),
        }),
      )
      .min(L.chartSeries.min)
      .max(L.chartSeries.max)
      .describe("One to three data series. Each needs one value per label."),
    source: z
      .string()
      .max(L.chartSource)
      .optional()
      .describe(
        'Where the numbers come from. Example: "Company report, 2025".',
      ),
  })
  .refine(
    (chart) =>
      chart.series.every((s) => s.values.length === chart.labels.length),
    { message: "Every series needs exactly one value per label" },
  )
  .describe("Data for a chart scene. Never invent numbers.");

export const mediaSchema = z
  .strictObject({
    query: z
      .string()
      .min(2)
      .max(L.mediaQuery)
      .optional()
      .describe(
        'Plain-words search for a fitting stock picture or clip. Example: "sunrise over a quiet city street".',
      ),
    assetId: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe("Id of an asset already in the project's library."),
    path: z
      .string()
      .min(1)
      .max(L.mediaPath)
      .refine(isSafeRelativePath, {
        message: "Use a relative path inside the project, without '..'",
      })
      .optional()
      .describe('Relative path of a supplied file. Example: "media/demo.mp4".'),
  })
  .refine(
    (m) =>
      [m.query, m.assetId, m.path].filter((v) => v !== undefined).length === 1,
    { message: "Give exactly one of query, assetId or path" },
  )
  .describe(
    "Picture or clip for the scene. Provide exactly one of query, assetId or path.",
  );

function isSafeRelativePath(value: string): boolean {
  if (/^([a-z][a-z0-9+.-]*:|[\\/])/i.test(value)) return false;
  return !value.split(/[\\/]/).includes("..");
}

export const sceneSchema = z
  .strictObject({
    type: sceneTypeSchema,
    headline: textLine(
      L.headline,
      'Short on-screen text, at most 60 characters, a complete phrase that is not cut off. Example: "Sleep is a skill".',
    ),
    narration: z
      .string()
      .trim()
      .min(1)
      .max(L.narration)
      .describe(
        'What the voice says: full sentences, at most 400 characters, written to be heard. Do not repeat the headline word for word. Example: "Most adults need seven to nine hours. Treat sleep like training, not an afterthought."',
      ),
    body: textLine(
      L.body,
      "Optional supporting line shown under the headline, at most 200 characters.",
    ).optional(),
    items: z
      .array(textLine(L.item, "One short point, at most 60 characters."))
      .min(L.itemCount.min)
      .max(L.itemCount.max)
      .optional()
      .describe(
        'Points for a list scene, 2 to 6. Example: ["Same bedtime", "No screens", "Cool room"].',
      ),
    stat: z
      .strictObject({
        value: textLine(
          L.statValue,
          'The big figure, at most 12 characters. Example: "73%".',
        ),
        label: textLine(
          L.statLabel,
          'What the figure measures, at most 40 characters. Example: "report better focus".',
        ),
      })
      .optional()
      .describe("Key number for a stat scene."),
    chart: chartSchema.optional(),
    quote: z
      .strictObject({
        text: textLine(
          L.quoteText,
          "The quotation, at most 160 characters, exactly as said.",
        ),
        attribution: textLine(
          L.quoteAttribution,
          'Who said it. Example: "Dr. Mara Lin, sleep researcher".',
        ),
      })
      .optional()
      .describe("Quotation for a quote scene. Only real, attributed quotes."),
    code: z
      .strictObject({
        language: z
          .string()
          .regex(/^[a-z0-9+#-]{1,20}$/i)
          .describe('Language name. Example: "typescript".'),
        text: z
          .string()
          .min(1)
          .max(L.codeText)
          .refine((t) => t.split("\n").length <= L.codeLines, {
            message: `At most ${L.codeLines} lines`,
          })
          .describe("The snippet, at most 12 lines and 600 characters."),
      })
      .optional()
      .describe("Code for a code scene."),
    media: mediaSchema.optional(),
    icon: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,39}$/)
      .optional()
      .describe(
        'Optional icon name in lowercase words joined by hyphens. Example: "moon".',
      ),
    emphasis: z
      .array(
        textLine(
          L.emphasisWord,
          "A word or short phrase copied from the headline or body.",
        ),
      )
      .max(L.emphasisCount)
      .optional()
      .describe(
        'Up to three words from the headline or body to highlight. Example: ["skill"].',
      ),
    durationHint: z
      .number()
      .min(L.durationHint.min)
      .max(L.durationHint.max)
      .optional()
      .describe(
        "Rough seconds for the scene, 2 to 30. Only a hint: real timing follows the narration length. Omit unless you need a longer pause.",
      ),
  })
  .superRefine((scene, ctx) => {
    const need: Partial<
      Record<(typeof SCENE_TYPES)[number], keyof typeof scene>
    > = {
      list: "items",
      stat: "stat",
      chart: "chart",
      quote: "quote",
      code: "code",
      media: "media",
    };
    const field = need[scene.type];
    if (field && scene[field] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `A ${scene.type} scene needs "${field}"`,
      });
    }
  })
  .describe("One scene: what is shown and what is said.");

const base = {
  version: z.literal(STORYBOARD_VERSION).describe("Schema version. Always 1."),
  title: textLine(
    L.title,
    'Title of the video or episode. Example: "Why sleep is a skill".',
  ),
  music: musicSchema.default("auto"),
  sources: z
    .array(sourceSchema)
    .max(L.sources)
    .optional()
    .describe(
      "Pages you used for facts. Leave out if you used none. Never invent sources.",
    ),
};

export const videoStoryboardSchema = z
  .strictObject({
    ...base,
    kind: z
      .literal("video")
      .default("video")
      .describe('"video" (default) for a video.'),
    format: formatSchema.default("9:16"),
    theme: slug
      .optional()
      .describe(
        "Optional visual theme name. Omit to let Reel Studio choose a look that fits the content.",
      ),
    voice: voiceSchema.optional(),
    captions: captionsSchema.default("auto"),
    scenes: z
      .array(sceneSchema)
      .min(L.scenes.min)
      .max(L.scenes.max)
      .describe(
        "Scenes in order. About 8 scenes make a 60-second video. Start with a hook and end with a cta or a statement that closes the idea.",
      ),
  })
  .describe("A video storyboard.");

export const speakerSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,19}$/)
    .describe('Short id used by turns. Example: "host".'),
  name: textLine(L.speakerName, 'Display name. Example: "Maya".'),
  voiceId: z
    .string()
    .min(1)
    .max(60)
    .optional()
    .describe("Voice name. Omit for the default voice."),
});

export const turnSchema = z.strictObject({
  speaker: z.string().describe("The id of a speaker listed in speakers."),
  text: z
    .string()
    .trim()
    .min(1)
    .max(L.turnText)
    .describe(
      "What this speaker says, at most 600 characters, written to be heard.",
    ),
});

export const podcastStoryboardSchema = z
  .strictObject({
    ...base,
    kind: z.literal("podcast").describe('"podcast" for an audio episode.'),
    speakers: z
      .array(speakerSchema)
      .min(L.speakers.min)
      .max(L.speakers.max)
      .describe(
        "One to three speakers: solo narration, a two-host talk or an interview.",
      ),
    turns: z
      .array(turnSchema)
      .min(L.turns.min)
      .max(L.turns.max)
      .describe("The dialogue in order."),
  })
  .superRefine((podcast, ctx) => {
    const ids = new Set<string>();
    for (const [index, speaker] of podcast.speakers.entries()) {
      if (ids.has(speaker.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["speakers", index, "id"],
          message: `Duplicate speaker id "${speaker.id}"`,
        });
      }
      ids.add(speaker.id);
    }
    for (const [index, turn] of podcast.turns.entries()) {
      if (!ids.has(turn.speaker)) {
        ctx.addIssue({
          code: "custom",
          path: ["turns", index, "speaker"],
          message: `Unknown speaker "${turn.speaker}"; use one of ${[...ids].join(", ")}`,
        });
      }
    }
  })
  .describe("A podcast storyboard: speakers and their turns.");

/**
 * One file, one version: a video (the default) or a podcast. `kind` may be
 * omitted for a video.
 */
export const storyboardSchema = z.union([
  videoStoryboardSchema,
  podcastStoryboardSchema,
]);

export type Scene = z.infer<typeof sceneSchema>;
export type VideoStoryboard = z.infer<typeof videoStoryboardSchema>;
export type PodcastStoryboard = z.infer<typeof podcastStoryboardSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
export type StoryboardInput = z.input<typeof storyboardSchema>;

/** Parse untrusted JSON (a string or a value) into a validated storyboard. */
export function parseStoryboard(input: unknown): Storyboard {
  const value =
    typeof input === "string" ? (JSON.parse(input) as unknown) : input;
  const kind =
    value && typeof value === "object" && "kind" in value
      ? (value as { kind?: unknown }).kind
      : undefined;
  // Validate against the matching variant so errors name the real problem
  // instead of "no union member matched".
  return kind === "podcast"
    ? podcastStoryboardSchema.parse(value)
    : videoStoryboardSchema.parse(value);
}

/** The published JSON Schema (draft-07). Defaults are optional on input. */
export function storyboardJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(storyboardSchema, {
    target: "draft-7",
    io: "input",
  }) as Record<string, unknown>;
  return {
    ...schema,
    $id: "https://github.com/mohitkale/reel-studio/blob/main/schemas/storyboard.v1.json",
    title: "Reel Studio Storyboard v1",
  };
}
