# Podcast writer prompt

The prompt Reel Studio gives a model to write a podcast episode as a Storyboard v1
document with `"kind": "podcast"`. Paste it into any chat app, then send your brief.
Post the reply to `POST /api/storyboards`: it makes the cast, loads the script, adds
intro and outro music and queues the episode, mastered to -16 LUFS. Fields and limits:
[Storyboard](../STORYBOARD.md).

This file is generated from `src/providers/ai/storyboard-prompt.ts` by
`npm run storyboard:schema`; do not edit it by hand.

## 1. Prompt

```text
You write one podcast episode for Reel Studio. Reply with a single JSON object that matches the supplied JSON Schema, and nothing else. kind is "podcast".

Craft
- It must sound spoken. Short turns, usually one to three sentences. Contractions, reactions ("Right.", "Huh, I didn't know that."), real questions and answers.
- Never read a list aloud. Turn points into a back and forth: one speaker asks, the other explains, then a follow-up.
- The host opens by welcoming the listener and naming the topic in one sentence, and closes with one clear takeaway and a thanks.
- Speakers address each other by name now and then, not every turn.
- Be concrete: use real numbers, names and examples from the brief or research notes. Never invent statistics, quotes or sources. If a fact is not in the brief or notes, leave it out.
- Length: about 2.5 spoken words per second of the target length.

Cast
- One speaker for a solo narration (id "host"), two for a conversation (ids "host" and "guest"). Give each a first name. Use only voice names from the voice list when you set voiceId, otherwise leave it out.
- Every turn's speaker is the id of one of the speakers.

Rules
- Do not describe music, sound effects or pauses; they are added later.
- sources: only pages listed in the research notes, each with its title, url and the date accessed.
- publish: a title, a one or two sentence description and up to ten hashtags for the episode listing. Leave out what you are unsure of.
- Write in the language of the brief.
```

## 2. Your brief

```json
{
  "task": "Write the podcast storyboard for this brief.",
  "brief": {
    "topic": "Why the sky is blue",
    "audience": "curious adults",
    "targetSeconds": 180,
    "speakers": 2,
    "tone": "warm and curious"
  }
}
```

## 3. JSON Schema

```json
{"type":"object","properties":{"version":{"type":"number","enum":[1],"description":"Schema version. Always 1."},"title":{"type":"string","description":"Title of the video or episode. Example: \"Why sleep is a skill\"."},"music":{"type":"string","description":"Background music. \"auto\" picks a fitting bundled track, \"none\" for silence, or a track id. Default \"auto\"."},"variety":{"description":"How much the look varies from scene to scene inside the theme: \"low\", \"medium\" (default) or \"high\".","type":"string","enum":["low","medium","high"]},"seed":{"description":"Look seed. The same storyboard and seed always give the same video; a new seed gives a different cut. Omit to derive one from the title.","anyOf":[{"type":"string"},{"type":"integer"}]},"series":{"description":"Series name. Videos in one series share a look family (the same seed unless a seed is given) so they read as one show, and the look stays locked against Shuffle.","type":"string"},"reduceMotion":{"description":"Calmer output: no camera moves and gentler entrances. Default false.","type":"boolean"},"sfx":{"description":"Sound effects (a whoosh on transitions, a tick on list items, a pop on emphasis) at a low level under the narration. \"auto\" (default) adds them, \"off\" leaves them out.","type":"string","enum":["auto","off"]},"stings":{"description":"A short chime at the start and another at the end of the video. \"auto\" adds them; omit for none.","type":"string","enum":["auto","off"]},"sources":{"description":"Pages you used for facts. Leave out if you used none. Never invent sources.","type":"array","items":{"type":"object","properties":{"title":{"type":"string","description":"Title of the page or document. Example: \"WHO sleep guidance\"."},"url":{"type":"string","description":"Public http(s) address of the source."},"accessed":{"type":"string","description":"Date you read it, YYYY-MM-DD. Example: \"2026-11-13\"."}},"required":["title","url","accessed"]}},"publish":{"type":"object","properties":{"title":{"description":"Title for posting, at most 100 characters. A clear promise, not clickbait. Example: \"Why the sky is blue\".","type":"string"},"description":{"description":"Post description: one or two sentences of what the viewer gets. No hashtags here; they go in hashtags.","type":"string"},"hashtags":{"description":"Up to ten hashtags, with or without the # sign.","type":"array","items":{"type":"string"}},"thumbnailText":{"description":"Three to six big words for the thumbnail, at most 40 characters. Example: \"Why is the sky blue?\".","type":"string"}},"description":"How to post the video: title, description, hashtags and thumbnail text. Leave out what you are unsure of."},"language":{"description":"The language the narration is written in, when it is not American English: \"en-GB\", \"es\", \"fr\", \"hi\", \"it\", \"ja\", \"pt-BR\" or \"zh\". The voice is chosen to match.","type":"string","enum":["en-US","en-GB","es","fr","hi","it","ja","pt-BR","zh"]},"kind":{"type":"string","enum":["podcast"],"description":"\"podcast\" for an audio episode."},"speakers":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Short id used by turns. Example: \"host\"."},"name":{"type":"string","description":"Display name. Example: \"Maya\"."},"voiceId":{"description":"Voice name. Omit for the default voice.","type":"string"}},"required":["id","name"]},"description":"One to three speakers: solo narration, a two-host talk or an interview."},"turns":{"type":"array","items":{"type":"object","properties":{"speaker":{"type":"string","description":"The id of a speaker listed in speakers."},"text":{"type":"string","description":"What this speaker says, at most 600 characters, written to be heard."}},"required":["speaker","text"]},"description":"The dialogue in order."}},"required":["version","title","kind","speakers","turns"],"description":"A podcast storyboard: speakers and their turns."}
```
