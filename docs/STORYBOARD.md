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

## Linting and auto-repair

Models drift: a code fence around the JSON, `"vertical"` for a format, a stat
written on the scene instead of inside `stat`. `lintStoryboard(reply, options)`
(`src/storyboard/lint.ts`) accepts a reply string or an object and returns
`{ storyboard, fixes, warnings, errors }`.

- **fixes** are repairs already applied to the returned storyboard: extra text
  around the JSON, trailing commas, trimmed whitespace, filled defaults, unknown
  fields dropped (including internal ids), near-miss values mapped (`bullet-list`
  to `list`, `vertical` to `9:16`), loose shapes gathered (`value`/`label` into
  `stat`), an overlong headline moved into `body` and shortened at a clause
  boundary, counts clamped.
- **warnings** mean the storyboard is valid but weak: headline equal to narration,
  three of one scene type in a row, no hook first, no closing scene, narration under
  3 or over 40 words, a stat without a number, estimated length outside the range you
  asked for (`minSeconds`, `maxSeconds`).
- **errors** appear only when nothing safe can be repaired. Each has `path`,
  `message`, `expected` and `example`, so a model can fix it in one retry.

Over HTTP: `POST /api/storyboards/lint` with the storyboard, or
`{ "storyboard": <object or reply text>, "options": { "minSeconds": 45 } }`. It is
read-only and always answers 200 with `ok`. Twenty recorded model replies in
`src/storyboard/fixtures/model-outputs/` are linted in the unit tests.

## Writing one with a model

The only AI step is writing this JSON. One prompt, published at
[prompts/storyboard-writer.md](prompts/storyboard-writer.md), works in any chat
app: paste it, then your brief. Inside Reel Studio every provider (Gemini, OpenAI,
Ollama, LM Studio, llama.cpp) gets the same prompt through its native structured
output with the schema, then the reply goes through the linter. One retry at most,
fed with the linter's errors (on a cloud provider that is a second paid call; pass
`"retry": false` to avoid it). `POST /api/storyboards/write` with
`{ "providerId": "gemini", "brief": { "topic": "..." } }` returns the linted
storyboard and writes nothing; post it to `POST /api/storyboards` to produce the video.

**Research.** With Gemini or OpenAI, `research` defaults to `auto`: one web-grounded
research call runs first, its facts and real URLs go into the brief, and the cited
pages land in `storyboard.sources`. Only URLs the provider returned as grounding (or
that you supplied in `brief.researchNotes`) can appear there; the writer cannot add
others. The result is cached by topic for 24 hours (`.data/storyboard-research-cache.json`),
so repeating a topic costs nothing. That is one extra paid request on a cloud
provider; set `"research": "off"`, or `"fromSourceText": true` when your topic is your
own text, to skip it. Local models and an unconfigured provider skip research and the
response carries the note _Written without web research_. If the search fails the
storyboard is still written, with a note saying why. An agent using MCP does its own
research and passes the facts in `brief.researchNotes`.

## Producing a video

```bash
curl -X POST "http://localhost:3000/api/storyboards" \
  -H "Content-Type: application/json" \
  -d @examples/storyboards/product-launch.json
```

One call lints and repairs the storyboard, creates the editable project, picks
the look, synthesizes narration with the local voice, aligns captions, attaches
music and queues a single durable job. The answer has `jobId` and `projectId`;
poll `GET /api/production-jobs/<jobId>`. When the job succeeds its video output
carries the duration, the lint report (`storyboard.fixes` and `storyboard.warnings`)
and `contactSheet`, a JPEG with one frame per scene. Open the project in the editor
afterwards to change anything by hand.

- Options are query parameters or a wrapper body `{ "storyboard": {...}, "dryRun": true }`:
  `quality` (`draft`, `standard`, `high`), `dryRun`, `force`.
- `dryRun` returns the resolved plan (scene treatments, orientation, voice, music,
  captions, estimated length, what is not applied yet) and creates nothing.
- Posting the same storyboard with the same options returns the existing job
  (`reused: true`). Add `force` to produce again.
- A storyboard with errors that cannot be repaired answers `422` with the same
  `errors` as the linter, each with `expected` and `example`.
- Podcast storyboards are not produced here yet.

The code path is `produceFromStoryboard` in `src/library/storyboard-production.ts`;
MCP and the CLI will call the same function. Scene types map to today's treatments
(`hook` to the opener, `chart` to the data chart, `media` to B-roll, and so on). Fields the
renderer cannot show yet (`body` on most scenes, `icon`, `theme`, `voice.speed`, `media.path`,
and a code scene's formatting) are listed in the plan's `warnings` instead of being dropped silently.

## Export and import

Every project can be exported as a storyboard: `GET /api/scripts/<id>/storyboard`
(add `?download=1` for a file), or **Storyboard → Export storyboard JSON** in the
editor. **Import storyboard JSON** makes a new editable project from a document or a
pasted chat reply (`POST /api/storyboards?createOnly=1`); nothing is rendered and the
open project is untouched.

Projects made from a storyboard remember its extra details (a stat's label, a quote's
headline, a code scene's language, `icon`, `durationHint`, theme, sources) and write
them back as long as that scene's copy is unchanged; edits made in the editor always
win. Older projects export from the scene model alone, mapping legacy templates onto
the nine scene types; anything that cannot be carried over exactly is listed in `notes`
(for example a template with no v1 equivalent becomes a `statement`). Normalised, a
storyboard survives storyboard → project → storyboard unchanged; the one thing that does
not is a `code` scene's formatting beyond its text, which the renderer shows as a bold
statement today.

## The golden set

`examples/storyboards/` holds twelve hand-written storyboards (a product launch,
explainer, listicle, data story, how-to, news recap, motivation, developer demo,
comparison, myth versus fact, story and a podcast episode) in all three formats.
`npm run examples:check` validates and lints them (zero fixes and warnings; it also
runs in the unit tests). `npm run examples:render` renders the eleven videos through
`POST /api/storyboards` into `media/examples/` with a contact sheet each; start the app
first.

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
