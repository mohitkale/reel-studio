# Creator guide

Reel Studio's default path is designed to finish a useful production without
per-scene setup:

1. Open **Projects** and choose **Create production**.
2. Choose a polished video or a voiceover-first video.
3. Paste a script, brief, or public article URL. You can attach screenshots,
   images, video, or audio.
4. Choose a preset, engine, canvas, brand kit, and narration workflow.
5. Review the generated draft, produce the voice, then render and download it.

The deterministic planner works without an AI key. It keeps the complete source
as narration and derives short display copy for readable scenes. AI planning is
optional and produces the same validated, editable structure.

## Quick Produce or review first

**Quick Produce** appears in Create with AI and is off by default. Leave it off
when you want to review scenes, media, voice, and captions before rendering.
Enable it when the chosen planner and defaults are ready to run unattended.

An enabled request still creates an ordinary editable project. Reel Studio also
freezes the submitted revision and runs that snapshot through the durable job
stages. Refreshing or restarting reconnects to the saved progress. Edits made
after submission cannot alter the in-flight or completed output; the editor
shows a conflict and lets you reopen the completed revision as a new project or
produce the current revision separately.

The credential-free choice is deterministic planning with stock media set to
None and server-side Kokoro (or voice disabled). Ollama and LM Studio are local
optional planners. Gemini, OpenAI, stock search, and paid voice providers are
used only when explicitly selected and configured.

## Choose the right preset

| Preset              | Best input                                              | Useful supplied assets                       |
| ------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Product Launch      | Problem, product promise, features, proof, CTA          | Product screenshots or a screen recording    |
| Editorial Explainer | Headline, explanation, steps, quote, summary            | Diagrams, portraits, or source illustrations |
| Creator Punch       | Strong hook, short tips, payoff, CTA                    | Talking-head footage, screenshots, or b-roll |
| Data Story          | Labeled values, units, comparisons, takeaway            | CSV-derived values or a source graphic       |
| Developer Demo      | Code, diff, terminal output, browser proof              | Browser screenshots and exact code excerpts  |
| Cinematic Brand     | Brand idea, product story, attributed quote, logo close | High-resolution photography or video         |

Reel Studio never invents chart values, testimonials, URLs, or product results.
Supply structured data for a chart and attribution for a quote. Automatic
planning chooses a non-data layout when no values are available.

## Voice, captions, and podcasts

- Use one full take for continuous narration, or scene clips when you expect to
  revise individual lines. Unchanged scene clips are reused.
- Import SRT/VTT captions, use provider timing, or start with clearly labeled
  estimated timing. Optional whisper.cpp alignment stays local.
- Choose a caption appearance preset or adjust font, placement, colors, box,
  outline, shadow, wrapping, and highlighting. The preview uses the same style
  snapshot and safe-area measurements as export.
- Start podcasts as solo narration, a two-host discussion, or an interview. Add
  optional six-second intro/outro audio, per-turn pauses, and pronunciation
  substitutions before generating a take. Saved takes retain an immutable
  snapshot of those finishing choices.
- Regenerate selected turns, then export WAV, MP3, transcript, and chapters.
- Select a contiguous podcast excerpt manually, use local timestamp-grounded
  suggestions with no AI key, or explicitly ask a configured AI provider for
  ranges. Displayed quotes always come from the saved take transcript. Produce a
  portrait, landscape, or square audiogram with the original take audio.

## Format variants and batch work

The Renders page and MCP support durable batches of up to ten input rows. Video
and audiogram rows default to portrait, landscape, and square outputs. Each
format reflows the source scene layout for its canvas; it does not crop another
render. Successful child outputs remain available when another row fails.

Named MCP tokens can be limited by scope, providers, duration, batch size,
automatic rendering, and paid requests. Use a token with automatic rendering
only for a trusted local automation. See [the MCP guide](../mcp/README.md).

## First production checklist

Run the setup once, then check the local runtime:

```bash
npm run setup
npm run doctor
npm run dev
```

Open **Gallery** for shipped examples and preset entry points. Open
**Diagnostics** before a campaign batch. To prove rendering without a cloud key,
run:

```bash
npm run sample:export
```

The sample uses bundled content and placeholder speech, then writes a verified
local MP4 that appears under **Renders**. Use real local Kokoro or a configured
voice provider for material you intend to publish.

## A reliable launch workflow

1. Save the source brief, exact claims, media, and brand kit.
2. Create one master draft and lock approved copy and assets.
3. Generate voice and captions before final visual timing.
4. Preview openings, transitions, captions, safe areas, and the ending in the
   target canvas.
5. Render each format independently and listen to the complete audio mix.
6. Download verified artifacts and subtitles. Keep the source project so later
   revisions can reuse unchanged work.

Short-form launch validation covers videos up to three minutes and podcasts up
to ten minutes. Existing longer projects remain editable, but they are outside
the initial release acceptance matrix.
