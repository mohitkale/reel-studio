# Voice providers

Narration is made on this computer by default, with Kokoro (an 82M-parameter
open model, Apache-2.0). Other providers are optional.

## The voice gallery

`/voices` lists every local voice (54) with its language and gender. Filter by
language, gender and tone, press play for a sample, and star the voices you use
(the stars are kept in this browser). Each language has one suggested voice. A
sample is made on this computer the first time and then plays from the cache.

Tone words are only set for the six voices that were picked as a starting set
(Heart, Nova, Michael, Adam, Emma, George). The rest show language and gender.

## Languages

A storyboard can set `language` (`en-US`, `en-GB`, `es`, `fr`, `hi`, `it`, `ja`,
`pt-BR`, `zh`). When it does:

- A voice that speaks another language is replaced by that language's suggested
  voice, and the linter records the fix. A voice that is not a Kokoro voice (a
  cloud or cloned voice) is never second-guessed.
- With no `voiceId`, the suggested voice for the language is used.
- On the result page, **Make it in this language** asks the storyboard writer to
  translate the words and makes a new video from the same scenes. The video is
  timed again from the new narration.

**Pronunciation is the limit.** This build's phonemizer carries the English
dictionary only (`vendor/phonemizer`). The non-English voices therefore read
their text with English pronunciation rules: right voice, approximate
pronunciation, and Hindi, Japanese and Mandarin scripts are not read at all. The
linter warns (`language-pronunciation`). Fixing it means rebuilding the
phonemizer with the other languages' dictionaries (`scripts/build-phonemizer.sh`),
which is not done yet. A multilingual provider (Cartesia, ElevenLabs, or a
VoiceForge engine) reads these languages natively. Nobody who speaks these
languages has checked the output.

## Styles

One voice, four ways of reading it, set with `voice.style` or the **Style** menu
on the result page. Each is plain arithmetic, so the same text and style always
give the same audio:

| Style       | Speed | Pauses | Pitch     |
| ----------- | ----- | ------ | --------- |
| Calm        | 0.92× | 1.35×  | −0.5 tone |
| Energetic   | 1.10× | 0.70×  | +0.8 tone |
| Storyteller | 0.95× | 1.50×  | −1.0 tone |
| News        | 1.05× | 0.60×  | 0         |

The storyteller also takes a longer beat before a punchline or a number. Pitch
moves at most two semitones: the audio is generated slower by the pitch ratio and
played back faster by the same amount, which changes the pitch and keeps the
length. Styles apply to the local Kokoro voice; other providers ignore them.
Whether the four are audibly distinct on one voice has not been checked by ear.

## Cloning

Cloning is optional and local: the self-hosted VoiceForge service
(`VOICEFORGE_SERVICE_URL`). When a server is configured, `/voices` shows the
clone panel. It requires ticking a box that says you have the rights to the voice
before anything is uploaded. There is no cloud cloning.

## Adding a voice model

A provider implements `VoiceProvider` in `src/providers/voice/types.ts` and is
registered in `src/providers/voice/registry.ts`. Nothing else in the pipeline
names a vendor.

```ts
export interface VoiceProvider {
  id: ProviderId; // add the id to PROVIDER_IDS
  label: string;
  runtime: "server" | "client"; // "server" returns audio from synth()
  keyless?: boolean; // runs with no API key (a local model)
  maxConcurrency?: number; // CPU-bound local models should use 1
  isConfigured(): boolean;
  listModels(): Promise<VoiceModel[]>;
  listVoices(query?: string): Promise<VoiceSummary[]>;
  synth?(opts: SynthOptions): Promise<SynthResult>; // 16-bit PCM WAV bytes
}
```

`synth` receives `voiceId`, `text`, `speed`, `style` and `language`; it may ignore
any it does not support. Return a WAV at the requested sample rate, and word
timings in `words` if the model reports them (otherwise timing is estimated and
the optional whisper check corrects it). Give each voice a `language` so the
gallery and the linter can place it. See `src/providers/voice/kokoro-server.ts`
for a local model and `src/providers/voice/voiceforge.ts` for a self-hosted
service.
