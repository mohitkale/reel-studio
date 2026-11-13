# Podcasts and audio

Podcasts are audio-first projects: dialogue turns, voices, finishing controls,
exports, and optional video audiograms.

## Create a podcast

1. Open **Podcasts** and create a show, or run `npm run seed:demo-podcast` for a
   seeded two-host example.
2. Choose a format: **solo narration**, **two-host discussion** or **interview**.
   Edit turns and characters by hand, import a script, or ask a configured AI
   provider to write the dialogue (the only AI step).
3. Assign a voice to each speaker. Podcast takes run on the server, so use
   `kokoro-server` for a no-key local result; browser-only providers are rejected.
4. Generate a take. Unchanged turns are reused from cache; regenerate only the
   turns you edit.

## Finishing

- Optional six-second intro and outro, per-turn pauses and pronunciation
  substitutions. Each take keeps the finishing choices it was made with.
- Export **WAV**, **MP3**, transcript and chapters. **Episode package** downloads
  audio, transcript, chapters, show notes and a manifest together.
- Podcasts support up to ten minutes per take.

## Recordings and transcripts

Podcasts accept audio files or microphone recordings up to 15 minutes. The
microphone starts only after you press Record. Imports are converted to mono
44.1 kHz PCM, and imported audio never invents timing from the script.

With an installed whisper.cpp and model, choose **Transcribe locally** to create a
transcript-bearing take; review words and speaker labels (Whisper does not
identify speakers), then **Save reviewed transcript** to create a new take that
shares the audio. Cancelling transcription keeps the imported take.

## Waveform editing

Open **Waveform & transcript** on a saved voiceover or podcast take to edit the
real audio locally (up to 128 MiB and 30 minutes): keep or remove selections,
adjust speaker levels, audition rumble filtering and gentle compression. Save the
edit plan (with undo/redo), download the edited WAV and JSON manifest, or **Save as
new take**, which leaves the source untouched. Transcript text cut by an edit is
marked for review before captions are published.

## Audiograms and clips

Select a contiguous excerpt manually, use local timestamp-grounded suggestions
(no AI key), or explicitly ask a configured provider for ranges. Quotes always
come from the saved transcript. Create a portrait, landscape or square audiogram
that uses the original take audio, and follow it on **Renders**.

## Voiceovers for videos

**Voiceovers** is a paragraph editor for narration: generate one complete take or
per-scene clips, compare a second take, and open the same project in the video
editor with **Add visuals**. Speaking rate is available for Cartesia, VoiceForge
and server Kokoro. Shared speech presets store named voices and pronunciation
dictionaries.

REST and MCP offer the same podcast creation, take and download operations; see
[MCP](MCP.md). Troubleshooting and provider notes: [Getting started](GETTING_STARTED.md#configuration),
[Troubleshooting](TROUBLESHOOTING.md).
