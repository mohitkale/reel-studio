# Getting started

Reel Studio runs on your machine. Projects, media and renders stay local; AI,
stock and cloud voice providers are optional and only receive data when you
configure and use them.

## Requirements

- Node **24 LTS**, minimum **24.15** (`.nvmrc` selects major 24).
- FFmpeg and FFprobe on `PATH`.
- An installed Chrome or Chromium browser, used for local exports.
- Writable local SQLite and media directories.

## Install and run

```bash
npm ci
npm run setup
npm run doctor
npm run dev
```

Open `http://localhost:3000`. Setup creates missing `.env.local` settings, safely
migrates recognized databases and seeds examples; it never overwrites existing
configuration. Kokoro downloads and caches its model weights on first speech
synthesis. Narration is off by default for the Generate flow.

| Command                           | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `npm run demo`                    | Setup plus supervised development launch  |
| `npm run doctor`                  | Required and optional runtime diagnostics |
| `npm run sample:export`           | Credential-free example MP4               |
| `npm run build` / `npm run start` | Build and run the production app + worker |
| `npm run seed:gallery`            | Install bundled gallery examples          |
| `npm run mcp`                     | Start the stdio agent integration         |

The launcher supervises the web app and one durable production worker. Do not
start a second worker for ordinary use. In development, editing source during an
active render can interrupt that job; retry after the reload.

## Make a first video

1. On **Projects**, choose **Create production**, paste a few sentences and select
   **Build draft**. No AI key is needed; the local planner arranges your content.
2. Preview the scenes in the editor, optionally add narration, then select
   **Export MP4**. Follow the render and download it under **Renders**.
3. For an AI-written draft, choose **Create with AI** after configuring a provider
   in **Settings**. For an unattended video, enable **Quick Produce**.

## Simple and Pro

A clean install opens in **Simple**: five destinations (Create, Library,
Podcasts, Brand, Settings), a first-run setup (ready check, voice, who writes the
storyboard) and one Create box. **Pro** adds every editor and manual workspace.
An install that already has videos opens in Pro with nothing moved. Switch in
the header or in **Settings**, which also has **Run setup again** and **Review
each video before it is made**. Switching never changes your videos.

**Settings** also has **What runs by itself** (web research, voice, music and
captions; each can be changed for one video under More options on Create). On a
finished video, **Change it** edits text, order, look and music in place and
links back to the previous version, **Tell me what to change** asks the
storyboard writer for edits and shows them before anything is made, and **Share
it** copies a caption with hashtags and makes the other two sizes or another
voice from the same storyboard.

See [Creating videos](CREATING_VIDEOS.md) for the full workflow.

## Configuration

Optional variables are documented in [`.env.example`](../.env.example); keep real
credentials in the private `.env.local`.

**Local AI.** In **Settings → Local AI director**, save an existing server
endpoint, check the connection, pick a model, then save again. Reel Studio does
not install, start or download these servers or models.

| Server    | Default endpoint         |
| --------- | ------------------------ |
| Ollama    | `http://127.0.0.1:11434` |
| LM Studio | `http://127.0.0.1:1234`  |
| llama.cpp | `http://127.0.0.1:8080`  |

Loopback is the default; private LAN endpoints need an explicit per-provider
opt-in. Settings are stored in owner-protected `.data/local-ai-config.json`,
separate from cloud keys.

**Transcription.** Optional local transcription uses your whisper.cpp through
`WHISPER_CPP_BIN` and `WHISPER_CPP_MODEL`. Captions with estimated timing work
without it.

**Docker (trusted development only).**

```bash
cp .env.example .env.local
docker compose up --build
```

Compose publishes `127.0.0.1:3000`, supervises app and worker, and mounts source
writable for hot reload. Rendering uses host CPU and memory. For model servers on
the host use `host.docker.internal` with explicit LAN opt-in.

## What stays local

| Capability                   | Local behaviour                                     |
| ---------------------------- | --------------------------------------------------- |
| Projects, scripts, podcasts  | SQLite database                                     |
| Uploaded assets and renders  | Files under `media/` (git-ignored)                  |
| HyperFrames preview + export | Runs on your machine or in Docker on localhost      |
| Kokoro voice                 | In the browser or a local server, no key            |
| Bundled music                | CC0 files in `public/music/`                        |
| Planning                     | Manual, deterministic, Ollama, LM Studio, llama.cpp |

Data leaves your machine only when you configure and use a provider: Gemini or
OpenAI (the prompts you submit), Pexels, Pixabay or Unsplash (search queries),
ElevenLabs or Cartesia (text, and cloning samples if used) and Jamendo (music
search). There is no analytics or telemetry. See [SECURITY.md](../SECURITY.md).

Narration with the local voice, checked on a fresh clone (17 Nov 2026, macOS, Node 24.18,
Intel i7-9750H): `git clone`, `npm ci` (2 min), `npm run setup -- --voice` (48 s, including the
90 MB model), `npm run dev`, then a narrated video from a storyboard
(`node bin/reel-studio.mjs render motivation.json --quality draft`, 55 s for 20.8 s of video).
The MP4 had a video and an audio stream at -14.0 LUFS. Creating a video from a typed prompt on
the home screen also needs an AI writer (a Gemini or OpenAI key, or a local model).

Voices and providers:

| Provider      | Runs where  | Key      | Notes                                       |
| ------------- | ----------- | -------- | ------------------------------------------- |
| Web Speech    | Browser     | No       | Instant preview only                        |
| Kokoro        | Browser     | No       | Apache-2.0 82M model, 54 voices             |
| Kokoro server | Local Node  | No       | Same model; used for podcasts and jobs      |
| Cartesia      | Cloud       | Yes      | Vendor terms; cloning available             |
| ElevenLabs    | Cloud       | Yes      | Vendor terms; free tier uses a WAV fallback |
| VoiceForge    | Self-hosted | Optional | Separate project; engine licences vary      |

Generated and cloned voices can be restricted by provider terms; see
[licensing](LICENSING.md).

## Upgrading and rolling back

1. Stop the app and background worker.
2. Back up the SQLite database and `media/` folder together, including any WAL/SHM
   files and `.env.local`.
3. Update the code, run `npm ci`, then `npm run setup` (applies migrations through
   the backup-aware runner).
4. Run `npm run doctor`, restart, and open an existing project and export.

To roll back, stop the app and worker, restore the paired database and media
backup, check out the prior release and use its locked install. Never open an
upgraded database with an older app. Keep the backup until the upgrade is accepted.
Use `npm run db:migrate` for migrations; never `db:push` on an existing database.
Older release notes are in [archive/releases](archive/releases/).

Problems? See [Troubleshooting](TROUBLESHOOTING.md).
