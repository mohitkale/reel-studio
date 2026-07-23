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

From a running app (or via `npm run export:demo-assets`):

1. Open each format of a polished demo project (9:16, 16:9, 1:1).
2. Generate a real voice take (not silent placeholder).
3. Render at **standard** quality (or draft for faster iteration).
4. Copy / compress outputs into:

```text
docs/assets/examples/portrait-demo.mp4
docs/assets/examples/landscape-demo.mp4
docs/assets/examples/square-demo.mp4
```

5. Export a poster frame (first or mid frame) as matching `.jpg` files.

Keep clips short. Prefer HyperFrames for Apache-2.0-only demos when that matters;
Remotion demos are fine if licensing for redistributed samples is understood.

Audio for README demos lives **inside the MP4** — do not commit a separate
podcast WAV for launch assets. The in-app podcast seed (`npm run seed:demo-podcast`)
is still useful for local tryouts.

## Rules

- Synthetic script only (see `src/library/demo-content.ts`)
- No API keys, personal names, or copyrighted media in committed assets
- Use bundled CC0 music only (`public/music/`)
- Do not fabricate screenshots the app cannot produce
