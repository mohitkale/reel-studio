# Demo capture guide

How to regenerate open-source launch visuals from the real app.

## Prerequisites

```bash
nvm use   # Node 22+
npm install
npm run setup
npm run dev
```

Open `http://localhost:3000`. No cloud API keys are required for the HyperFrames
demo project. Kokoro may download model weights on first podcast take.

## Seeded demos

| Asset | How to open |
| --- | --- |
| Video project | Projects → **Content Creation in 30 Seconds** |
| All formats | `npm run seed:demo-project -- --all-formats` |
| Podcast | Podcasts → **Content Creation Tips** |

## Screenshots

1. Open the demo project in the editor (scenes + preview visible).
2. Capture a full-window PNG at ~1440×900 or higher.
3. Save as `docs/assets/reel-studio-editor.png`.
4. Optional: Podcasts workspace → `docs/assets/reel-studio-podcast.png`.

Prefer a populated timeline over an empty state.

## Workflow GIF (optional)

Record 8–12 seconds: open project → scrub scenes → play preview → open Render.

Suggested tools: macOS Screenshot toolbar (record), or `ffmpeg` desktop capture.
Optimize for GitHub (under ~5 MB) without making UI text unreadable.

Save as `docs/assets/script-to-video.gif`.

## Sample MP4s

From a running app (or via scripts once added):

1. Open each format of the demo project (9:16, 16:9, 1:1).
2. Generate a take (placeholder silent, or `kokoro-server`).
3. Render at **draft** or **standard** quality.
4. Copy outputs from `media/renders/` to:

```text
docs/assets/examples/portrait-demo.mp4
docs/assets/examples/landscape-demo.mp4
docs/assets/examples/square-demo.mp4
```

5. Export a poster frame (first or mid frame) as matching `.jpg` files.

Keep clips short (three scenes). Prefer HyperFrames so redistributed demos stay
on the Apache-2.0 path.

## Podcast sample audio

1. Open **Content Creation Tips**.
2. Generate a take with the seeded Kokoro voices.
3. Copy the WAV/MP3 from `media/` (or download from the Audio tab) to
   `docs/assets/examples/podcast-demo.wav`.

## Rules

- Synthetic script only (see `src/library/demo-content.ts`)
- No API keys, personal names, or copyrighted media in committed assets
- Use bundled CC0 music only (`public/music/`)
- Do not fabricate screenshots the app cannot produce
