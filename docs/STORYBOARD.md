# Storyboard

A **storyboard** is one JSON document that describes a whole video or podcast.
It is the only thing an AI model writes for Reel Studio. Voice, layout, motion,
colour, transitions, captions, music, timing and rendering are all decided
locally and deterministically from it.

- Schema: [`schemas/storyboard.v1.json`](../schemas/storyboard.v1.json) (JSON Schema draft-07).
- Source of truth: `src/storyboard/schema.ts` (Zod). Regenerate the JSON Schema
  with `npm run storyboard:schema`; the unit tests fail if the checked-in file is stale.
- Validate in code: `parseStoryboard(json)` from `src/storyboard`.

Writing one is a single request to any model: give it the schema and a topic. The
schema carries a description, a limit and an example for every field, and limits
are enforced by validation rather than by prompt text.

## Video

| Field      | Required | Meaning                                                                    |
| ---------- | -------- | -------------------------------------------------------------------------- |
| `version`  | yes      | Always `1`.                                                                |
| `kind`     | no       | `"video"` (default) or `"podcast"`.                                        |
| `title`    | yes      | Up to 80 characters.                                                       |
| `format`   | no       | `"9:16"` (default), `"16:9"` or `"1:1"`.                                   |
| `theme`    | no       | Optional theme name. Omit to let Reel Studio pick a look that fits.        |
| `voice`    | no       | `{ enabled, voiceId?, speed? }`. Default: narrated with the default voice. |
| `music`    | no       | `"auto"` (default), `"none"` or a track id.                                |
| `captions` | no       | `"auto"` (default) or `"off"`.                                             |
| `sources`  | no       | Up to 12 `{ title, url, accessed }` for facts you used. Never invented.    |
| `scenes`   | yes      | 1 to 40 scenes. About eight scenes make a 60-second video.                 |

### Scene

| Field          | Required | Limit and meaning                                                              |
| -------------- | -------- | ------------------------------------------------------------------------------ |
| `type`         | yes      | One of the types below.                                                        |
| `headline`     | yes      | On-screen text, at most 60 characters, a complete phrase.                      |
| `narration`    | yes      | Spoken, full sentences, at most 400 characters. Not a copy of the headline.    |
| `body`         | no       | Supporting line, at most 200 characters.                                       |
| `items`        | list     | 2 to 6 points of at most 60 characters.                                        |
| `stat`         | stat     | `{ value (12 chars), label (40 chars) }`.                                      |
| `chart`        | chart    | 2 to 6 `labels`, 1 to 3 `series` with one number per label, optional `source`. |
| `quote`        | quote    | `{ text (160 chars), attribution (60 chars) }`.                                |
| `code`         | code     | `{ language, text }`, at most 12 lines and 600 characters.                     |
| `media`        | media    | Exactly one of `query` (plain words), `assetId` or `path` (relative file).     |
| `icon`         | no       | Icon name such as `moon`.                                                      |
| `emphasis`     | no       | Up to three words from the headline or body to highlight.                      |
| `durationHint` | no       | Seconds, 2 to 30. A hint only; timing follows the narration length.            |

Scene types in v1 are the treatments that exist today: `hook`, `statement`,
`list`, `stat`, `chart`, `quote`, `code`, `media` and `cta`. A type whose name
appears in the "Required" column (for example `list`) must carry that field.
New types are added without changing the version.

Nothing in a storyboard refers to internal ids: no template, recipe, capability or
catalog block names. Unknown fields are rejected.

## Podcast

Same file, same version, with `kind: "podcast"`, `speakers` (one to three, each
with an `id`, a `name` and an optional `voiceId`) and `turns` (1 to 80, each with a
`speaker` id and up to 600 characters of `text`). `title`, `music` and `sources`
work as for video.

## What is decided locally

Layout, motion treatments, colour, transitions, caption style, music choice and
mix, voice synthesis, scene timing from the narration length, media selection from
a `query`, and rendering. The model never sees these.

## Versioning

Additive changes (new optional fields, new scene types) keep `version: 1`.
Anything breaking becomes `version: 2` with a converter from version 1.

## Examples

A 60-second vertical explainer (about 150 spoken words, 8 scenes):

```json
{
  "version": 1,
  "title": "Why sleep is a skill",
  "format": "9:16",
  "scenes": [
    {
      "type": "hook",
      "headline": "You can train your sleep",
      "narration": "Most people treat sleep as luck. It is closer to a skill you can practise, and the results show up fast."
    },
    {
      "type": "stat",
      "headline": "Most adults need 7 to 9 hours",
      "narration": "Health agencies agree on seven to nine hours for most adults. Anything less, and focus and mood are the first things to go.",
      "stat": { "value": "7-9 h", "label": "recommended for adults" },
      "emphasis": ["7 to 9"]
    },
    {
      "type": "statement",
      "headline": "Consistency beats catching up",
      "narration": "A steady bedtime does more than one long lie-in. Your body clock loves a rhythm and punishes a surprise.",
      "icon": "clock"
    },
    {
      "type": "list",
      "headline": "A simple evening routine",
      "narration": "Keep the same bedtime, dim the lights an hour before, put the phone away and keep the room cool.",
      "items": [
        "Same bedtime",
        "Dim the lights",
        "Phone away",
        "Cool, dark room"
      ]
    },
    {
      "type": "quote",
      "headline": "What sleep researchers say",
      "narration": "Researchers put it plainly. Regular sleep is one of the cheapest health habits there is.",
      "quote": {
        "text": "Regular sleep is the cheapest health habit we have.",
        "attribution": "Dr. Mara Lin, sleep researcher"
      }
    },
    {
      "type": "media",
      "headline": "Light is the signal",
      "narration": "Morning light tells your body clock the day has started. Step outside within an hour of waking.",
      "media": { "query": "sunrise over a quiet city street" }
    },
    {
      "type": "statement",
      "headline": "Small changes, real gains",
      "narration": "You do not need a perfect routine. Pick one habit this week and keep it for seven nights."
    },
    {
      "type": "cta",
      "headline": "Try it tonight",
      "narration": "Set your bedtime now, then follow for more simple habits that add up."
    }
  ],
  "sources": [
    {
      "title": "Sleep health guidance",
      "url": "https://www.cdc.gov/sleep/about/index.html",
      "accessed": "2026-11-13"
    }
  ]
}
```

A landscape developer demo with a chart and a code scene, no voice and no music:

```json
{
  "version": 1,
  "title": "Cache it once",
  "format": "16:9",
  "voice": { "enabled": false },
  "music": "none",
  "captions": "off",
  "scenes": [
    {
      "type": "hook",
      "headline": "Stop fetching the same data",
      "narration": "Every repeated request costs time you can save with one small change."
    },
    {
      "type": "code",
      "headline": "A tiny cache",
      "narration": "Wrap the call once and reuse the result for a minute.",
      "code": {
        "language": "typescript",
        "text": "const cache = new Map<string, Data>();\n\nexport async function load(id: string) {\n  const hit = cache.get(id);\n  if (hit) return hit;\n  const data = await fetchData(id);\n  cache.set(id, data);\n  return data;\n}"
      }
    },
    {
      "type": "chart",
      "headline": "Median response time",
      "narration": "In our test, the median response dropped from 240 to 40 milliseconds.",
      "chart": {
        "labels": ["Before", "After"],
        "series": [{ "label": "Median", "values": [240, 40], "unit": "ms" }],
        "source": "Internal benchmark, 2026"
      }
    },
    {
      "type": "cta",
      "headline": "Cache it once",
      "narration": "Try it on your slowest endpoint first."
    }
  ]
}
```

A two-host podcast:

```json
{
  "version": 1,
  "kind": "podcast",
  "title": "Is sleep a skill?",
  "speakers": [
    { "id": "maya", "name": "Maya" },
    { "id": "sam", "name": "Sam" }
  ],
  "turns": [
    {
      "speaker": "maya",
      "text": "Today we ask whether sleep is something you can practise."
    },
    {
      "speaker": "sam",
      "text": "I say yes. A steady routine changes how fast you fall asleep."
    },
    {
      "speaker": "maya",
      "text": "So where would you start if you only change one thing?"
    },
    {
      "speaker": "sam",
      "text": "A fixed bedtime. Everything else builds on that."
    }
  ]
}
```
