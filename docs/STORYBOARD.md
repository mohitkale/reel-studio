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

| Field          | Required | Meaning                                                                                                                                                                                                                                                                                                                                         |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`      | yes      | Always `1`.                                                                                                                                                                                                                                                                                                                                     |
| `kind`         | no       | `"video"` (default) or `"podcast"`.                                                                                                                                                                                                                                                                                                             |
| `title`        | yes      | Up to 80 characters.                                                                                                                                                                                                                                                                                                                            |
| `format`       | no       | `"9:16"` (default), `"16:9"` or `"1:1"`.                                                                                                                                                                                                                                                                                                        |
| `theme`        | no       | One of the themes below, or `"auto"`. Omit to let Reel Studio pick one.                                                                                                                                                                                                                                                                         |
| `voice`        | no       | `{ enabled, voiceId?, speed?, style? }`. Default: narrated with the default voice. `style` is `calm`, `energetic`, `storyteller` or `news`.                                                                                                                                                                                                     |
| `language`     | no       | `en-US` (default), `en-GB`, `es`, `fr`, `hi`, `it`, `ja`, `pt-BR` or `zh`. A voice that speaks another language is swapped for the language's own.                                                                                                                                                                                              |
| `music`        | no       | `"auto"` (default), `"none"` or a track id.                                                                                                                                                                                                                                                                                                     |
| `variety`      | no       | `"low"`, `"medium"` (default) or `"high"`: how much the look varies from scene to scene.                                                                                                                                                                                                                                                        |
| `seed`         | no       | A string or whole number. The same storyboard and seed give the same video; a new seed gives a different cut. Default: derived from the title (or the series).                                                                                                                                                                                  |
| `series`       | no       | A series name. Videos with the same `series` share one look family (seed `series:<name>`, unless a `seed` is given) and their look is locked against Shuffle look.                                                                                                                                                                              |
| `reduceMotion` | no       | `true` for calmer output: no camera moves, gentler entrances.                                                                                                                                                                                                                                                                                   |
| `sfx`          | no       | `"auto"` (default) adds low-level sound effects; `"off"` leaves them out.                                                                                                                                                                                                                                                                       |
| `stings`       | no       | `"auto"` adds a short rising chime at the start and a falling one that ends with the last scene (needs sound effects on). Omit and a brand kit that names its own stings still plays them; `off` turns all stings off. They are saved as sound cues you can move or remove.                                                                     |
| `beatSync`     | no       | `"auto"` starts every scene on a beat of a bundled music track (the half beat for slow tracks). Only the silence between two scenes changes, by a fraction of a second (0.3 to 0.8 s instead of the usual 0.45 s); the narration is never stretched. It does nothing for music you uploaded or when music is off. Omit for the usual even gaps. |
| `presenter`    | no       | `{ character, placement }`: a drawn host who speaks the narration with lip sync. `character` is `maya`, `sam`, `ada`, `rex`, `orb` or `bolt`; `placement` is `corner` (a round bubble, default) or `full` (a large host). A scene with `presenter: "off"` hides it. Nods and sway are drawn on recording clips only.                            |
| `captions`     | no       | `"auto"` (default) or `"off"`.                                                                                                                                                                                                                                                                                                                  |
| `sources`      | no       | Up to 12 `{ title, url, accessed }` for facts you used. Never invented.                                                                                                                                                                                                                                                                         |
| `publish`      | no       | How to post it: `{ title (100), description (1500), hashtags (up to 10), thumbnailText (40) }`, every field optional. The writer fills it in the same call; the publishing kit and thumbnails use it.                                                                                                                                           |
| `chapters`     | no       | Long videos: up to 20 `{ title, startScene }` marking where each chapter starts (0-based scene number; the first is 0). The publishing kit turns them into timestamps. Valid long storyboards with up to 12 chapters can export up to ten minutes. The renderer reuses completed sections after an interruption.                                |
| `scenes`       | yes      | 1 to 120 scenes. About eight scenes make a 60-second video.                                                                                                                                                                                                                                                                                     |

### Scene

| Field          | Required                 | Limit and meaning                                                                                                                                                                                                                                 |
| -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | yes                      | One of the types below.                                                                                                                                                                                                                           |
| `headline`     | yes                      | On-screen text, at most 60 characters, a complete phrase.                                                                                                                                                                                         |
| `narration`    | yes                      | Spoken, full sentences, at most 400 characters. Not a copy of the headline.                                                                                                                                                                       |
| `body`         | no                       | Supporting line, at most 200 characters.                                                                                                                                                                                                          |
| `items`        | list                     | 2 to 6 points of at most 60 characters.                                                                                                                                                                                                           |
| `stat`         | stat                     | `{ value (12 chars), label (40 chars) }`.                                                                                                                                                                                                         |
| `chart`        | chart                    | 2 to 6 `labels`, 1 to 3 `series` with one number per label, optional `source` and `kind` (`bar`, `line`, `donut`).                                                                                                                                |
| `compare`      | comparison, before-after | `{ left, right }`, each `{ label (24 chars), text (80 chars) }`.                                                                                                                                                                                  |
| `points`       | timeline, diagram        | 2 to 5 `{ label (24 chars), text? (70 chars) }` in order.                                                                                                                                                                                         |
| `definition`   | definition               | `{ term (40 chars), meaning (160 chars) }`.                                                                                                                                                                                                       |
| `quote`        | quote                    | `{ text (160 chars), attribution (60 chars) }`.                                                                                                                                                                                                   |
| `code`         | code                     | `{ language, text }`, at most 12 lines and 600 characters.                                                                                                                                                                                        |
| `media`        | media                    | Exactly one of `query` (plain words), `assetId`, `path` (relative file) or `generate` (a prompt for an optional local image model; a `query` beside it is the fallback).                                                                          |
| `icon`         | no                       | Icon name such as `moon`.                                                                                                                                                                                                                         |
| `illustration` | no                       | A looping background illustration: a name such as `stars-2` (sixty exist), a motif (`orbits`, `waves`, `bubbles`, `network`, `bars`, `rays`, `leaves`, `skyline`, `gears`, `dots`, `stars`, `spiral`) or a related word like `space` or `growth`. |
| `emphasis`     | no                       | Up to three words from the headline or body to highlight.                                                                                                                                                                                         |
| `pace`         | no                       | `slow` (about 12% slower), `normal` or `fast` (about 12% faster) for this scene's narration, on top of the voice speed and style.                                                                                                                 |
| `durationHint` | no                       | Seconds, 2 to 30. A hint only; timing follows the narration length.                                                                                                                                                                               |

There are twenty-one scene types. Every one is shown in every format on the app's
`/scenes` page.

| Type            | Use it for                                       | Needs        |
| --------------- | ------------------------------------------------ | ------------ |
| `hook`          | The opening line                                 |              |
| `statement`     | One key idea                                     |              |
| `kinetic-text`  | A punchy line slammed in word by word            |              |
| `list`          | Two to six points                                | `items`      |
| `steps`         | Numbered steps in order                          | `items`      |
| `checklist`     | Things to tick off                               | `items`      |
| `recap`         | A short summary of what was just covered         | `items`      |
| `stat`          | One big number                                   | `stat`       |
| `comparison`    | Two options side by side                         | `compare`    |
| `before-after`  | A change from one state to another               | `compare`    |
| `timeline`      | Moments in order                                 | `points`     |
| `diagram`       | Connected parts of a process or system           | `points`     |
| `chart`         | Bars, a line or a donut from real values         | `chart`      |
| `quote`         | A real, attributed quotation                     | `quote`      |
| `definition`    | A term and its meaning                           | `definition` |
| `code`          | A snippet in a code window                       | `code`       |
| `terminal`      | Shell commands (lines starting `$` are commands) | `code`       |
| `media`         | A full-frame picture or clip                     | `media`      |
| `media-split`   | A picture beside the headline                    | `media`      |
| `device-mockup` | A phone showing a picture or the `body` text     |              |
| `cta`           | The closing call to action                       |              |

A scene whose data is missing or wrong is drawn as a statement instead of
failing. New types are added without changing the version.

### Themes

`bold-pop`, `clean-minimal`, `midnight-tech`, `editorial-paper`, `neon`,
`warm-documentary`, `corporate-blue`, `playful-pastel`, `mono-brutalist`, `cinematic`
along with `sunset`, `forest` and `high-contrast`. See the [Sunset preview](assets/themes/sunset.jpg),
[Sunset export](assets/themes/sunset-export.jpg), [Forest preview](assets/themes/forest.jpg)
and [Forest export](assets/themes/forest-export.jpg). The [High Contrast preview](assets/themes/high-contrast.jpg)
and [export](assets/themes/high-contrast-export.jpg) use a black, white and yellow palette.
A theme sets the palette,
a bundled font pair, type treatment, corner and stroke, background treatment, motion
personality, caption style and music mood, and works with every scene type.
With `theme` omitted or `"auto"` the studio picks one from the storyboard's words
(at least two keyword matches), or uses the production look. An explicitly selected
or customized brand kit supplies its own palette and fonts.

Nothing in a storyboard refers to internal ids: no template, recipe, capability or
catalog block names. Unknown fields are rejected.

## Podcast

Same file, same version, with `kind: "podcast"`, `speakers` (one to three, each
with an `id`, a `name` and an optional `voiceId`) and `turns` (1 to 80, each with a
`speaker` id and up to 600 characters of `text`). `title`, `music`, `sources` and
`publish` work as for video. Posting a podcast storyboard to `POST /api/storyboards`
(or calling the MCP tool `create_podcast`) makes the podcast with its cast and voices,
loads the script, adds intro and outro music from the bundled library, and queues the
episode, mastered to -16 LUFS. The finished take has WAV and MP3, a transcript,
chapter markers and show notes, in one package at `/api/podcast-takes/:id/bundle`.
The writer prompt for a spoken, two-host episode is
[prompts/podcast-writer.md](prompts/podcast-writer.md).

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
- A podcast storyboard answers with `kind: "podcast"`, a `podcastId` (also in `projectId`) and the episode `jobId`; follow it at `GET /api/podcasts/:id/takes/:jobId`.

The code path is `produceFromStoryboard` in `src/library/storyboard-production.ts`;
MCP and the CLI will call the same function. Scene types map to today's treatments
(`hook` to the opener, `chart` to the data chart, `media` to B-roll, and so on). Fields the
renderer cannot show yet (`body` on most scenes, `voice.speed` and `media.path`)
are listed in the plan's `warnings` instead of being dropped silently.

### Where pictures come from

A `media` or `media-split` scene gets its picture from one of these, in this order:

1. `media.assetId`: a picture or clip already in the library (always works, no network).
2. `media.generate`, when an optional local image model is set up.
3. `media.query` (or the headline, when there is no query): a stock search that runs on its own
   against **Pexels, then Pixabay**, so one of those needs a key in Settings.
   Unsplash pictures can only be chosen by hand in the editor, because their terms require a
   hotlink, so an Unsplash key alone does not supply pictures to a video made from a storyboard.

When no picture is found, the scene is **drawn as a plain statement** (a `media-split` scene
too, rather than an empty box beside the headline), and the result says so: `create_video`
and `POST /api/storyboards` return one warning per such scene (rule `media-unresolved`,
path `scenes.<n>.media`) naming the scene and the reason (no usable provider is set up, no
result for the query, or a provider refused), and `review_video` lists the same scenes as
findings. The reason is stored with the video, so a later review sees it.

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

- **Captions** follow the theme: `karaoke` (the spoken word lit), `pop` (two to three words
  at a time, large), `minimal`/`editorial` (a bar), and the storyboard's `captions: "off"`.
  Words in the headline's `emphasis` take the accent colour. Word timing comes from the
  voice when it reports it; otherwise standard and high quality exports listen to the take
  with the local whisper.cpp (when `WHISPER_CPP_MODEL` is set) and time each word where it
  was spoken, and drafts, or a setup without whisper.cpp, spread the words over each cue by
  length, so the highlight also works without narration. `npm run captions:verify` compares them with a second whisper model: with whisper timing the median error is about 47 ms and 78% of spot-checked words are within 80 ms (43 of 55 across eleven videos); the length estimate drafts use is off by about 190 ms. Pop
  captions scale in as each phrase appears. SRT and VTT use the same cue timings.
- **Variety**: a seeded director gives each scene one of three layouts (outlined card, colour
  wash, accent-edged card), one of four entrances and sometimes a slow camera move (push-in,
  pull-out, pan) with the background shapes moving against it. No layout or entrance repeats
  back to back, the first scene and about every fifteen seconds after carry a visual peak,
  and the accent and background treatment can change per video, inside the theme's allowed
  set. Every scene type also has three arrangements of its own content (a list as rows, a
  stair or hairline rows; a comparison stacked, staggered or with one side leading; a quote
  left, centred or ruled; a picture scene picture-first, copy-first or framed), and a scene
  type does not repeat the arrangement it used last. Same storyboard and seed resolve to the
  same plan. On the result page, **Shuffle look** re-rolls the seed and produces the video
  again; a video in a series keeps its look.
- **Transitions** come from the theme's motion personality (cut, push, wipe, zoom); a showy
  one is always followed by a cut.
- **Sound**: narration over a bundled music track that ducks under it by about 9 dB, plus
  sound effects unless `sfx` is `"off"`. The finished mix is mastered to about -14 LUFS with
  a -1 dBTP ceiling and measured.

## Versioning and stability

**Storyboard v1 is frozen** (roadmap L6). A storyboard that is valid today stays valid in every
1.x release, and the same storyboard keeps producing a video: you can keep storyboards in a
repository, or have an agent write them, and not worry that an update breaks them.

The schema may only **grow**:

| Allowed (keeps `version: 1`)                           | Not allowed (needs `version: 2` and a converter)                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| A new optional field                                   | Removing or renaming a field                                           |
| A new value in an enum (a new scene type, a new theme) | Removing a value from an enum                                          |
| A looser bound (a longer `maxLength`, more items)      | A tighter bound, a new `pattern`, or a new `required` field            |
| A new scene type with its own optional data            | Changing a field's type, or refusing unknown fields that were accepted |

It is enforced, not promised:

- `tests/fixtures/storyboard-v1/frozen.schema.json` is the schema at the freeze. A test
  (`src/storyboard/schema-compat.test.ts`) compares the published schema with it and fails,
  naming the path, on any change that would refuse a document the frozen schema accepted.
- `tests/fixtures/storyboard-v1/corpus/` holds the twelve golden storyboards and the thirty niche showcase storyboards as they were at the
  freeze. The same test lints each one (no errors, no repairs), plans it and builds its composition.
  The corpus only ever gains files; never edit one.
- After an additive change, `npm run storyboard:freeze` moves the baseline forward (it refuses if
  the change is not additive), so later changes are checked against the newest contract.

Behaviour is held the same way: a new look or a better layout may change how a scene is drawn, but
not what a valid storyboard means. Lint auto-repairs (see above) may be added and never removed.

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
