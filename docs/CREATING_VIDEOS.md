# Creating videos

Reel Studio turns text into a finished vertical, landscape or square video. This
guide covers the paths from idea to MP4. The only AI step is writing the scenes;
voice, captions, motion, audio and rendering run locally and deterministically.

## Choose a path

The **Projects** page leads with three ways to start:

- **Automatic (Quick Produce)**: one request produces a finished MP4.
- **Assisted (Create with AI)**: an AI provider writes editable scenes from an
  idea or script, which you review before exporting.
- **Manual (Create production)**: paste or import your own content (or start a
  blank project). The local planner arranges it; no AI key is needed.

Then review the scenes in the editor, add narration if wanted, and **Export MP4**.
Projects can be searched, filtered, assigned to a series and archived.

## Quick Produce or review first

Quick Produce is off by default. Enable it when the planner and defaults are ready
to run unattended. It still creates an ordinary editable project and also saves
the submitted version, which runs through durable stages (plan, media, audio,
captions and timing, composition, render, verification). Refreshing reconnects to
saved progress. Edits made afterwards never change the submitted output; the
editor shows the difference and lets you reopen the completed version as a new
project or produce the current one separately.

The credential-free combination is deterministic planning, stock media set to
**None**, and local Kokoro narration (or no narration). The **Add local
narration** checkbox uses voice `af_heart`; the first use may download the model.

## Presets

| Preset              | Best input                                   | Useful supplied assets                    |
| ------------------- | -------------------------------------------- | ----------------------------------------- |
| Product Launch      | Problem, promise, features, proof, CTA       | Product screenshots or screen recording   |
| Editorial Explainer | Headline, explanation, steps, quote, summary | Diagrams, portraits, illustrations        |
| Creator Punch       | Strong hook, short tips, payoff, CTA         | Talking-head footage, screenshots, b-roll |
| Data Story          | Labeled values, units, comparisons, takeaway | Values from a CSV or a source graphic     |
| Developer Demo      | Code, diff, terminal output, browser proof   | Browser screenshots, exact code excerpts  |
| Cinematic Brand     | Brand idea, product story, quote, logo close | High-resolution photography or video      |

Charts use only supplied labeled values; quotes need attribution. Automatic
planning picks a non-data layout when no values exist. See
[Scenes and themes](SCENES_AND_THEMES.md) for the visual system.

## Voice and captions

- Use one full take for continuous narration, or per-scene clips when you expect
  to revise lines; unchanged clips are reused.
- Captions: import SRT/VTT, use provider timing, or start with clearly labeled
  estimated timing; local whisper.cpp alignment is optional. Edit text and timing,
  and choose a caption style. Preview and export share the same style snapshot.
- Narration-cut suggestions are advisory. Optional **Balance export loudness**
  targets −16 LUFS / −1 dBTP.
- Music beat maps and sound effects are planned automatically; edit BPM, beats,
  clips, levels or timing, or mute them.

Podcasts and waveform editing are in [Podcasts and audio](PODCASTS.md).

## Direction and review

Open **Customize video** in the editor. **Visual direction** offers Clean,
Expressive or Showcase ambition and replans while preserving copy, narration,
media and locked scenes. **Visual review** captures scene sheets, phone-size
stills and transition frames, and can run one bounded repair for eligible short
text scenes. Review playback for motion and sound; stills alone prove neither.

## Longer videos and limits

- Ordinary video exports: up to **3 minutes**. Chaptered videos: up to
  **5 minutes**; opt-in lesson direction allows **10 minutes**. Podcasts: 10 minutes.
- Chapters: up to 12 chapters, 20 scenes each, 240 scenes total. Topic planning
  saves an editable draft and generates one chapter per explicit request.
- Chapter exports render in 30-second sections; retry reuses unchanged sections.
- Charts with several series page automatically (up to five rows and three
  series per page). Text entrances have adjustable timing (0.15–1.5 s per line).

## Research and editorial writing

- **Research** is a separate opt-in job (Gemini or OpenAI web grounding, or
  supplied text and public articles). Evidence keeps sources, dates, excerpts,
  conflicts and gaps. Citations show where a claim came from, not that it is true.
- **Editorial creation** writes a script first for review (intent, audience,
  tone, takeaway), then compiles the storyboard. Scoped revisions check for stale
  state and respect locks. Each provider call has its own budget.

## Media

Automatic stock selection ranks subject, crop, resolution and continuity, and
saves reasons and alternatives. Your uploads always take priority. Optional
vision scoring has a separate budget. **Product proof** maps supplied screenshots
and recordings to features; missing proof is flagged. Stock provider terms and
attribution apply; see [licensing](LICENSING.md).

## Series, batches and language versions

- **Content factory** (Renders page or editor): save series profiles, run a
  master as full-story formats and cutdowns, and review before rendering.
- **Batches**: up to ten rows of video, audio or audiogram work; video outputs
  default to portrait, landscape and square, each reflowed for its canvas.
- **Language versions**: paste a manual translation or request an optional AI
  translation preview; you review every paragraph before it becomes a new project.
- **Undo / Redo** restores up to 100 saved edits across reloads.

## A reliable launch workflow

1. Save the brief, exact claims, media and brand kit.
2. Create one master draft and lock approved copy and assets.
3. Generate voice and captions before final visual timing.
4. Preview openings, transitions, captions, safe areas and the ending.
5. Render each format and listen to the complete mix.
6. Download the verified MP4 and subtitles; keep the project for later reuse.

Run `npm run sample:export` for a credential-free render, check **Diagnostics**
before large batches, and browse the **Gallery** for presets and examples.
Automation through coding agents is covered in [MCP](MCP.md).
