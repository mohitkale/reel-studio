# Local AI

Reel Studio's only AI step is a model writing the storyboard JSON. Voice,
scenes, captions, music and the MP4 are made on this computer without a model.
This guide covers the optional things that run on your own machine.

## A storyboard writer on this computer

Open **Settings** (or the Create page when nothing can write yet). The studio
looks for [Ollama](https://ollama.com/download) and LM Studio:

- **Ollama running, no model:** one button downloads the model that fits this
  computer's memory, shows progress and selects it when it is done.
- **A model already installed:** pick it with one click.
- **Neither installed:** a link to install Ollama. The page notices it as soon as
  it runs; nothing is pasted.

Nothing is installed for you and no weights ship with the studio. Ollama fetches
the model from its own library.

### Recommended models

| Memory | Model         | Download | Notes                                                    |
| ------ | ------------- | -------- | -------------------------------------------------------- |
| 8 GB   | `qwen2.5:3b`  | ~1.9 GB  | Small: uses the short prompt and the two-step writer.    |
| 16 GB  | `qwen2.5:7b`  | ~4.7 GB  | The default for most computers.                          |
| 32 GB  | `qwen2.5:14b` | ~9.0 GB  | Best of the three; needs about 12 GB free while it runs. |

These are conservative picks of instruction-following models that support
JSON-schema constrained output. **They have not been measured here yet.** The
target is at least 10 of the 12 golden briefs passing the linter on the 16 GB
pick. Measure your own:

```bash
npm run benchmark:writers -- --provider ollama --model qwen2.5:7b
```

It writes the twelve briefs in `src/storyboard/benchmark-briefs.ts` (one per
golden example), lints each result, and prints pass or fail, model calls,
warnings and seconds per brief. `npm run benchmark:writers -- --fixture`
replays the golden examples instead of calling a model, to check the harness.

### How a weak model is helped

- The model is asked for **JSON-schema constrained output** where the server
  supports it, so the reply has the right shape.
- A model of about 4 B parameters or fewer gets a **shorter prompt** and the
  **two-step writer**: it plans three to five parts first, then writes each part,
  and every part is validated before they are joined. Ask for it on any model
  with `twoPass: true` on `POST /api/storyboards/write`.
- The linter's single retry stays on, with the exact problems fed back.

### Where the script gets written

The Create page and Settings show the order the studio tries and which step is
in use:

1. **A model on this computer.** Nothing leaves it.
2. **An online writer** (a Gemini or OpenAI key you added). Only your topic is
   sent. The studio never switches to it by itself: if your local model does not
   answer, it offers a button, and you choose.
3. **Your own chat assistant.** Copy the prompt, paste the reply. Always there.

## More local options

- Voices, languages and styles: [Voice providers](VOICE_PROVIDERS.md).

## Image generation (optional)

A scene can ask for a picture with `media.generate`, a plain-words prompt. This
is the only place a second model is involved, it is **off by default**, and it
runs on your computer.

1. Run a local image server: [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
   (default `http://127.0.0.1:8188`) or any server that answers
   `POST /v1/images/generations` and returns base64 images.
2. **Settings, Image generation:** choose the server, press **Test**, then
   **Turn on**. Nothing is downloaded for you. Only this computer, or a private
   network address you allow, can be reached.
3. Storyboards with `media: { generate: "..." }` now get that picture. A `query`
   beside it is the stock search used when no generator is set up.

```json
{
  "type": "media",
  "headline": "A quiet coast",
  "narration": "...",
  "media": {
    "generate": "a lighthouse on a cliff at dusk, calm sea",
    "query": "lighthouse at dusk"
  }
}
```

- The look supplies a style suffix (for example cinematic, neon, paper), so the
  pictures match the video. The seed comes from the video's seed and the scene
  number: the same video makes the same pictures.
- Pictures are cached by prompt, style, seed, size and model, and saved as
  library assets named `Generated: ...`, so they are listed in Assets and a
  repeat render makes nothing new.
- With nothing configured, or when a picture fails, the scene uses a stock
  picture or the themed background, and the result's warnings say which scenes
  fell back. It is never an error.
- The ComfyUI adapter queues a plain text-to-image graph (`CheckpointLoaderSimple`,
  `KSampler`, `SaveImage`) with the checkpoint you name, or the first installed.
  It was tested against a fixture server in CI, **not yet against a real ComfyUI
  with a model.**

To add another image backend, implement `ImageProvider`
(`src/providers/image/types.ts`) and add one case to
`src/providers/image/registry.ts`.

## Recordings to clips

Open **Recordings** (linked under the Create box, or `/recordings`) and import a
talk, a podcast or a screen capture (audio or video, up to 1 GB). Everything runs
on this computer:

1. **Transcribe.** FFmpeg extracts the audio and whisper.cpp writes a word-timed
   transcript (with DTW word times when the model supports them). This needs
   `whisper-cli` and a model (`WHISPER_CPP_BIN`, `WHISPER_CPP_MODEL`, see
   [Getting started](GETTING_STARTED.md)); the page and `list_options` say when it
   is missing.
2. **Suggest clips.** Plain rules, no model: runs of whole sentences of 20 to 55
   seconds, scored on a question or a number at the start, a question answered
   inside the clip, how many of the recording's frequent words it carries, the
   loudness of the audio and nearness to 35 seconds. Passages that start
   mid-thought are marked down. The same recording always gives the same picks.
3. **Edit by deleting text.** Click words in the transcript to cut them from the
   media. Options trim long silences (kept to about a third of a second) and
   remove "um" and "uh".
4. **Make the clips.** FFmpeg cuts the media once, then HyperFrames exports a
   9:16, 1:1 or 16:9 MP4 with a hook title card, word-synced captions in the
   chosen look, and either the speaker's video (whole picture over a blurred
   copy, or cropped to the middle) or a waveform for audio-only input. Each clip
   comes with a title, description and hashtags to copy, and is saved in Assets.

For an agent, `create_video` with `source: { path }` (instead of a storyboard)
does steps 1, 2 and 4 with the three best clips and returns their links and file
paths. Reframing is a plain centre crop or blurred fit; there is no face tracking.
Speakers are not separated.

## Animated presenter

A clip can be spoken by a drawn host with lip sync, all on this computer.
Choose a **Presenter** on the Recordings page: Maya and Sam (flat), Ada and Rex
(line art), Orb (3D look) or Bolt (a mascot). Audio-only recordings get the
presenter in the full frame in place of a waveform; recordings with video get a
corner bubble, the full frame, or a split screen next to the video. The mouth
follows the phonemes and timing of the words (twelve mouth shapes), falling back
to the loudness of the audio for words it cannot read. The character blinks,
nods on emphasis, raises its brows on a question and sways a little. How it
works and how to add a character: [Contributing presenters](CONTRIBUTING_PRESENTERS.md).

A narrated video can have the same presenter with `presenter: { character, placement }` in
its storyboard (`corner` bubble or `full` host); a scene with `presenter: "off"` hides it for
full-bleed pictures. In a storyboard video the mouth and blinks are drawn, but not the nods and
sway, and the live editor preview does not show the presenter (the export does). A video with a
presenter is exported in one piece rather than in reusable sections, so long ones take longer.

Not done yet: two presenters for a podcast audiogram, and the maintainer's review of the lip sync
at normal and half speed.
