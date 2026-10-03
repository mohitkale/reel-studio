# Advanced editing

Start with [the creator guide](CREATOR_GUIDE.md). These controls are in the
editor's **Customize video** section and keep saved projects editable.

## Motion and visual review

- Choose Clean, Expressive, or Showcase ambition; replan a variation while preserving copy, media, audio, and locks.
- Use supplied-data charts, diagrams, product frames, cinematic media, and quotation treatments.
- Inspect compatibility/fallback warnings; use repetition suggestions to review repeated treatments.
- Capture scene sheets, selected-scene moments, phone-size stills, or incoming transition frames.
- **Review and fix selected layout** allows one bounded repair/recapture for eligible short text scenes.
- Review playback for motion and sound; stills alone prove neither.

Reviews are revision-keyed. Layout repair preserves narration, data, assets, and
timing; locked/media/data/long-text scenes need manual edits. See [director](DIRECTOR_PIPELINE.md).

## Captions and audio finishing

- Edit caption text/timing or import/export SRT/VTT. Appearance snapshots share preview/export styling.
- Matching provider/transcription word timing enables word highlights and speech-aware sound cues.
- Estimated, stale, or mismatched timing remains labeled; it cannot stand in for measured words.
- Choose automatic SFX or edit clip, level, mute, and timing. Locked/manual cues retain priority.
- Review a local music beat map; edit BPM, phase, disabled beats, and drops.
- Narration-cut suggestions are advisory and require matching measured timing plus acknowledged review.
- Optional **Balance export loudness** targets −16 LUFS / −1 dBTP using measured FFmpeg passes; editor playback keeps original levels.

Unmeasurable/silent audio stays untouched. Export reports record measured delivery
results; supplied media and speech must still be listened to before publishing.

## Chapters and longer videos

- Save/edit chapter titles and scene boundaries; jump to each section.
- Chaptered creation preserves the complete supplied script.
- Topic planning saves an editable writing draft; each chapter generation is one explicit bounded provider request.
- Chapter-scoped rewriting changes only the selected unlocked scenes and rejects concurrent storyboard edits.
- Sweep/Rise chapter motifs share saved seed/direction while preserving data/media choreography.

Limits: **12 chapters, 240 scenes total, 20 scenes per chapter**. Valid chapter
storyboards support video production up to **300 seconds** at 24/30/60 FPS;
ordinary video and standalone audio retain their 180-second limits. Scoped-token
limits still apply. Longer editable drafts do not silently lose narration, but
can exceed export policy.

Chapter exports preserve global timing in cached 30-second visual sections.
Retry reuses valid sections; complete audio is assembled continuously each run.
See [runtime/recovery](RUNTIME.md) and [production contracts](production/CONTRACTS.md).

## Podcast finishing

Choose solo narration, a two-host discussion, or interview; assign server voices.
Use optional intro/outro bumpers, explicit turn pauses, pronunciation substitutions,
and selective turn regeneration. Takes retain immutable finishing choices.
Download WAV/MP3, transcript, and chapters, then create an audiogram from a
contiguous transcript-grounded excerpt using the original take audio.
