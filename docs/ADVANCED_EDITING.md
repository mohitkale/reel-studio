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
storyboards support video production up to **300 seconds** at 24/30/60 FPS.
Opt-in [lesson direction](LONG_FORM_DIRECTION.md) adds goals, examples and recap
callbacks with a **600-second** allowance and collapsible chapter navigation;
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

## Manual text timing and data

The scene inspector accepts multiple named chart series, row labels, units and
source attribution. Multiple series, negative values and long series use a paged table with up to five rows
and three series per page, preserving every supplied value and unit. Visual
review flags pages shorter than three seconds; split dense data into more scenes
or extend narration before publishing. Single-series charts retain their selected
compatible visual treatment.

Impact, Editorial and Stack text treatments expose **Text entrance timing**:
0.15–1.5 seconds per line, with linear, smooth or snappy easing. Preview and export
read the same saved settings. Reveal duration is bounded by available scene time;
the control does not retime narration, scene boundaries or ambient animation.
Click a scene in the preview to select it for inspection. Safe-zone guides remain
inside the video frame. Narrow screens place the preview before scene navigation
and provide Scenes, Script & design, and Audio tabs.
