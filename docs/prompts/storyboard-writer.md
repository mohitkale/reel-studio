# Storyboard writer prompt

The one prompt Reel Studio gives every model to write a storyboard. Paste it into
any chat app (ChatGPT, Claude, Gemini, a local model), then send your brief. The
reply is a Storyboard v1 JSON document: post it to `POST /api/storyboards` or
`POST /api/storyboards/lint`. Fields and limits: [Storyboard](../STORYBOARD.md).

This file is generated from `src/providers/ai/storyboard-prompt.ts` by
`npm run storyboard:schema`; do not edit it by hand.

## 1. Prompt

```text
You write one storyboard for Reel Studio. Reply with a single JSON object that matches the supplied JSON Schema, and nothing else.

Craft
- Hook in the first three seconds: scene one is a hook that makes the viewer want the next line.
- One idea per scene. A headline is at most seven words, a complete phrase that is never cut off.
- Narration is spoken language: short sentences, natural contractions. Never repeat the headline word for word.
- Be concrete: use real numbers, names and examples from the brief or research notes. Never invent statistics, quotes or sources. If a fact is not in the brief or notes, leave it out.
- Vary the scene types and never use the same type three times in a row. End with a payoff: a cta, or a statement that closes the idea.
- Length: about 2.5 spoken words per second of the target length, so roughly 8 scenes for 60 seconds.

Scene types
- hook: the opening line that grabs attention.
- statement: one key idea.
- list: 2 to 6 short parallel points (needs items).
- stat: one big number (needs stat).
- chart: compare values, only when the brief gives exact numbers (needs chart).
- quote: a real, attributed quotation (needs quote).
- code: a short snippet for developer topics (needs code).
- media: a picture or clip carries the scene (needs media with a plain-words query).
- cta: the closing call to action.

Rules
- Layout, colour, motion, timing and transitions are decided later. Do not describe them.
- sources: only pages listed in the research notes, each with its title, url and the date accessed.
- Use the requested format and tone, and write in the language of the brief.
```

## 2. Your brief

Send this after the prompt, with your own values. Only `topic` is required.

```json
{
  "task": "Write the storyboard for this brief.",
  "brief": {
    "topic": "Why sleep is a skill",
    "audience": "busy adults",
    "targetSeconds": 60,
    "format": "9:16",
    "tone": "clear and friendly",
    "researchNotes": [
      { "title": "Page title", "url": "https://example.com/page", "accessed": "2026-11-13", "notes": "Facts you want used." }
    ]
  }
}
```

## 3. JSON Schema

Apps that support structured output can take this schema directly; otherwise paste
it after the prompt. It lists every field with its limit and an example. The full
schema with all limits is [schemas/storyboard.v1.json](../../schemas/storyboard.v1.json).

```json
{"type":"object","properties":{"version":{"type":"number","enum":[1],"description":"Schema version. Always 1."},"title":{"type":"string","description":"Title of the video or episode. Example: \"Why sleep is a skill\"."},"music":{"type":"string","description":"Background music. \"auto\" picks a fitting bundled track, \"none\" for silence, or a track id. Default \"auto\"."},"sources":{"description":"Pages you used for facts. Leave out if you used none. Never invent sources.","type":"array","items":{"type":"object","properties":{"title":{"type":"string","description":"Title of the page or document. Example: \"WHO sleep guidance\"."},"url":{"type":"string","description":"Public http(s) address of the source."},"accessed":{"type":"string","description":"Date you read it, YYYY-MM-DD. Example: \"2026-11-13\"."}},"required":["title","url","accessed"]}},"kind":{"description":"\"video\" (default) for a video.","type":"string","enum":["video"]},"format":{"type":"string","enum":["9:16","16:9","1:1"],"description":"Canvas shape. \"9:16\" vertical for Reels, Shorts and TikTok; \"16:9\" landscape for YouTube; \"1:1\" square. Default \"9:16\"."},"theme":{"description":"Optional visual theme: \"bold-pop\", \"clean-minimal\", \"midnight-tech\", \"editorial-paper\", \"neon\", \"warm-documentary\", \"corporate-blue\", \"playful-pastel\", \"mono-brutalist\" or \"cinematic\". Omit or use \"auto\" to let Reel Studio choose a theme that fits the content.","type":"string"},"voice":{"type":"object","properties":{"enabled":{"description":"Narrate the video with a local voice. Default true.","type":"boolean"},"voiceId":{"description":"Voice name from the voice list, for example \"af_heart\". Omit to use the default voice.","type":"string"},"speed":{"description":"Speaking speed, 0.7 to 1.3. Omit for natural speed (1.0).","type":"number"}},"description":"Narration settings. Omit to narrate with the default voice."},"captions":{"type":"string","enum":["auto","off"],"description":"Captions generated from the narration. \"auto\" shows them, \"off\" hides them. Default \"auto\"."},"scenes":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string","enum":["hook","statement","list","stat","chart","quote","code","media","cta","kinetic-text","steps","comparison","before-after","timeline","definition","terminal","diagram","media-split","device-mockup","checklist"],"description":"What the scene is. hook: opening line that grabs attention. statement: one key idea. kinetic-text: a punchy line slammed word by word. list: 2-6 short points (needs items). steps: 2-6 numbered steps in order (needs items). checklist: 2-6 things to tick off (needs items). stat: one big number (needs stat). comparison: two options side by side (needs compare). before-after: a change from one state to another (needs compare). timeline: 2-5 moments in order (needs points). diagram: 2-5 connected parts of a process or system (needs points). chart: compare values (needs chart; chart.kind bar, line or donut). quote: a quotation (needs quote). definition: a term and its meaning (needs definition). code: a code snippet (needs code). terminal: shell commands and output (needs code). media: a full-frame picture or clip (needs media). media-split: picture beside the headline (needs media). device-mockup: a phone screen showing a picture (media optional). cta: closing call to action. Example: \"statement\"."},"headline":{"type":"string","description":"Short on-screen text, at most 60 characters, a complete phrase that is not cut off. Example: \"Sleep is a skill\"."},"narration":{"type":"string","description":"What the voice says: full sentences, at most 400 characters, written to be heard. Do not repeat the headline word for word. Example: \"Most adults need seven to nine hours. Treat sleep like training, not an afterthought.\""},"body":{"type":"string","description":"Optional supporting line shown under the headline, at most 200 characters."},"items":{"description":"Points for a list scene, 2 to 6. Example: [\"Same bedtime\", \"No screens\", \"Cool room\"].","type":"array","items":{"type":"string","description":"One short point, at most 60 characters."}},"stat":{"description":"Key number for a stat scene.","type":"object","properties":{"value":{"type":"string","description":"The big figure, at most 12 characters. Example: \"73%\"."},"label":{"type":"string","description":"What the figure measures, at most 40 characters. Example: \"report better focus\"."}},"required":["value","label"]},"chart":{"type":"object","properties":{"labels":{"type":"array","items":{"type":"string","description":"One category label."},"description":"Category labels along the axis. Example: [\"2023\", \"2024\", \"2025\"]."},"series":{"type":"array","items":{"type":"object","properties":{"label":{"type":"string","description":"Name of this data series. Example: \"Users\"."},"values":{"type":"array","items":{"type":"number"},"description":"One number per label, in the same order. Use real figures only."},"unit":{"description":"Unit shown with the numbers, for example \"%\" or \"k\".","type":"string"}},"required":["label","values"]},"description":"One to three data series. Each needs one value per label."},"source":{"description":"Where the numbers come from. Example: \"Company report, 2025\".","type":"string"},"kind":{"description":"How to draw it: \"bar\" to compare, \"line\" for change over time, \"donut\" for shares of a whole (first series only). Default \"bar\".","type":"string","enum":["bar","line","donut"]}},"required":["labels","series"],"description":"Data for a chart scene. Never invent numbers."},"compare":{"description":"Two sides for a comparison or before-after scene: left is the first option or the before state.","type":"object","properties":{"left":{"type":"object","properties":{"label":{"type":"string","description":"Short title of this side. Example: \"Before\"."},"text":{"type":"string","description":"One short sentence about this side, at most 80 characters."}},"required":["label","text"],"description":"The first option, or the before state. Example: {\"label\":\"Before\",\"text\":\"One hour per edit\"}."},"right":{"type":"object","properties":{"label":{"type":"string","description":"Short title of this side. Example: \"Before\"."},"text":{"type":"string","description":"One short sentence about this side, at most 80 characters."}},"required":["label","text"],"description":"The second option, or the after state. Example: {\"label\":\"After\",\"text\":\"One minute\"}."}},"required":["left","right"]},"points":{"description":"Two to five moments (timeline) or parts (diagram), in order. Example: [{\"label\":\"2019\",\"text\":\"Launch\"},{\"label\":\"2024\",\"text\":\"1M users\"}].","type":"array","items":{"type":"object","properties":{"label":{"type":"string","description":"A date, name or step title. Example: \"2024\"."},"text":{"description":"Optional short detail, at most 70 characters.","type":"string"}},"required":["label"]}},"definition":{"description":"Term and meaning for a definition scene.","type":"object","properties":{"term":{"type":"string","description":"The word being defined. Example: \"Latency\"."},"meaning":{"type":"string","description":"Plain-words meaning, at most 160 characters."}},"required":["term","meaning"]},"quote":{"description":"Quotation for a quote scene. Only real, attributed quotes.","type":"object","properties":{"text":{"type":"string","description":"The quotation, at most 160 characters, exactly as said."},"attribution":{"type":"string","description":"Who said it. Example: \"Dr. Mara Lin, sleep researcher\"."}},"required":["text","attribution"]},"code":{"description":"Code for a code scene.","type":"object","properties":{"language":{"type":"string","description":"Language name. Example: \"typescript\"."},"text":{"type":"string","description":"The snippet, at most 12 lines and 600 characters."}},"required":["language","text"]},"media":{"type":"object","properties":{"query":{"description":"Plain-words search for a fitting stock picture or clip. Example: \"sunrise over a quiet city street\".","type":"string"},"assetId":{"description":"Id of an asset already in the project's library.","type":"string"},"path":{"description":"Relative path of a supplied file. Example: \"media/demo.mp4\".","type":"string"}},"description":"Picture or clip for the scene. Provide exactly one of query, assetId or path."},"icon":{"description":"Optional icon name in lowercase words joined by hyphens. Example: \"moon\".","type":"string"},"emphasis":{"description":"Up to three words from the headline or body to highlight. Example: [\"skill\"].","type":"array","items":{"type":"string","description":"A word or short phrase copied from the headline or body."}},"durationHint":{"description":"Rough seconds for the scene, 2 to 30. Only a hint: real timing follows the narration length. Omit unless you need a longer pause.","type":"number"}},"required":["type","headline","narration"],"description":"One scene: what is shown and what is said."},"description":"Scenes in order. About 8 scenes make a 60-second video. Start with a hook and end with a cta or a statement that closes the idea."}},"required":["version","title","scenes"],"description":"A video storyboard."}
```
