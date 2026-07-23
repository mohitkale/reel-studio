# Reel Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Reel Studio is an open-source, local-first short-form video editor** for building portrait, landscape, or square videos end to end.

- Choose a video orientation per project (portrait 9:16, landscape 16:9, square 1:1)
- Script and scene editing
- AI scene planning that selectively adds relevant Unsplash stock backgrounds with varied pan/zoom motion (optional, needs an Unsplash key)
- AI voice takes (pluggable providers)
- Choose a video engine per project: **Remotion** or **HyperFrames** (Apache 2.0)
- Motion templates for each engine (Remotion React templates + HyperFrames-native HTML templates)
- MP4 rendering with queue and progress updates
- Project, asset, and brand-kit management

The app runs as a single Next.js project with API routes and UI in one codebase.

## Licensing

**Reel Studio’s own code** is MIT — see [LICENSE](LICENSE). Contributions are
welcome under the same terms ([CONTRIBUTING.md](CONTRIBUTING.md)).

**Important:** several dependencies and optional integrations are **not** MIT.
**Remotion** (default video engine) is **source-available under the Remotion
License, not OSI open-source**. Individuals and small teams are often covered
by Remotion’s Free License; for-profit organizations with 4+ employees typically
need a paid Remotion Company License. Our MIT grant does **not** waive those
obligations. Projects can instead use **HyperFrames** (Apache-2.0) for preview
and MP4 export without Remotion company/automator seats for those projects.

| Component | License / terms |
| --- | --- |
| Reel Studio app code, templates, MCP server code | **MIT** |
| Bundled ambient music (`public/music/`) | **CC0** |
| **Remotion** (Player, renderer, related packages) | **Remotion License** ([details](https://www.remotion.dev/license)) |
| **HyperFrames** (`@hyperframes/producer`, optional engine) | **Apache-2.0** |
| Kokoro TTS (`kokoro-js`) | Apache-2.0 |
| Unsplash / Jamendo / Cartesia / ElevenLabs / Gemini / OpenAI | Each provider’s own terms (optional keys) |
| VoiceForge engines (optional) | Per-engine (e.g. XTTS-v2 CPML non-commercial) |

Full breakdown, Free vs Company License notes, and a checklist:
**[docs/LICENSING.md](docs/LICENSING.md)**.

## Available Features

### Video Creation
- **Multi-format support**: Portrait (9:16), Landscape (16:9), Square (1:1)
- **Script and scene editing**: Scene-by-scene content creation
- **On-screen vs voice script**: Short display `text` plus optional longer `spokenText` for TTS
- **AI scene planning**: Automatically adds relevant Unsplash stock backgrounds with varied pan/zoom motion
- **Style + Energy looks**: Whole-reel Style (`bold-hook`, `clean-story`, `teach-me`, `soft-brand`) and Energy (`calm`, `normal`, `high`); default brand kit is **Coral Harbor**
- **Dual video engines**: Remotion (React) or HyperFrames (HTML, Apache 2.0) — chosen at project create
- **Remotion templates**: Kinetic typography, Lottie, 3D, emoji punch, icon grid, quote cards, stat reveal
- **HyperFrames templates**: Cold open, bold statement, paced list, proof number, pull quote, end card
- **MP4 rendering**: Queue-based rendering with progress updates (HyperFrames runs in an isolated worker)
- **Project management**: Organize projects, assets, and brand kits

### Voice & Audio
- **Multiple voice providers**:
  - **Kokoro** (Apache-2.0): Free, runs entirely in-browser, no API key needed
  - **Web Speech API**: Instant in-editor preview, no API key needed
  - **Cartesia**: Premium cloud voices with cloning support (vendor terms)
  - **ElevenLabs**: Premium cloud voices with extensive library (vendor terms)
  - **VoiceForge** (optional): Self-hosted cloning; engine licenses vary (see [docs/LICENSING.md](docs/LICENSING.md))
- **Voice modes**: **Oneshot** (one full-reel take) or **Per-scene** (generate/select clips per scene, then assemble)
- **Voice takes management**: Generate, compare, and select multiple takes
- **Caption sync**: Automatic timing alignment with voiceover
- **Background music**: Bundled CC0 beds; optional Jamendo Creative Commons search; user uploads are your responsibility

### AI Integration
- **AI scene generation**: Powered by Google Gemini or OpenAI
- **Voice script styles**: **Short** (on-screen text only) or **Detailed** (short on-screen + longer spoken narration)
- **MCP Server**: Model Context Protocol integration for AI tools — video storyboards **and** audio podcasts (see [mcp/README.md](mcp/README.md))
- **Smart content planning**: AI-assisted storyboard creation

### Developer Experience
- **Type-safe**: Full TypeScript with strict mode
- **Modern stack**: Next.js 16, React 19, Tailwind CSS v4
- **Docker support**: Containerized deployment for isolated environments
- **Comprehensive tooling**: ESLint, Prettier, Vitest
- **Local-first**: SQLite database with local asset storage

## Upcoming Features

### Voice Cloning
- **Local voice cloning**: Standalone project for training custom voice models locally
- **Voice fine-tuning**: Personalize existing voices with your own samples
- **Multi-language support**: Extended voice library for global content
- **Real-time voice conversion**: Transform voice characteristics on-the-fly

### Enhanced Video Capabilities
- **Advanced transitions**: More sophisticated scene transitions and effects
- **3D model integration**: Import and animate custom 3D models
- **Video overlays**: Picture-in-picture and overlay effects
- **Advanced text animations**: More kinetic typography options
- **Custom Lottie support**: Import and use custom Lottie animations

### AI & Automation
- **Auto-generated scripts**: AI-powered script writing from prompts
- **Smart scene suggestions**: AI recommendations for scene improvements
- **Batch processing**: Generate multiple videos from templates
- **Content optimization**: AI suggestions for engagement and retention

### Collaboration & Sharing
- **Project sharing**: Share projects with team members
- **Version control**: Built-in version history for projects
- **Cloud sync**: Optional cloud backup and sync
- **Collaborative editing**: Real-time collaboration features

### Performance & Scale
- **GPU acceleration**: Hardware-accelerated rendering
- **Distributed rendering**: Scale rendering across multiple machines
- **Advanced caching**: Intelligent caching for faster renders
- **Background processing**: Queue management for large batches

### Platform Expansion
- **Desktop app**: Native desktop applications (Windows, macOS, Linux)
- **Mobile companion**: Mobile app for quick edits and previews
- **Plugin system**: Extensible plugin architecture
- **API access**: REST API for programmatic control


## Tech Stack

- App: Next.js App Router + TypeScript (strict)
- UI: Tailwind CSS v4 + Radix-based components + lucide-react
- Data: TanStack Query + Zod
- Video: Remotion 4 and/or HyperFrames (`@hyperframes/producer`) — see [docs/LICENSING.md](docs/LICENSING.md)
- Persistence: Prisma + SQLite
- Storage: Local disk asset store under `media/`
- Tooling: ESLint, Prettier, Vitest
- Node.js: **≥ 22** recommended (required for HyperFrames renders; see `.nvmrc`)

## Quick Start

### 1. Install

```bash
# HyperFrames rendering requires Node 22+
nvm use   # respects .nvmrc
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Set only the keys you need. Empty values are fine for local non-provider testing.
Free, no-key voices work out of the box: **Kokoro** (Apache-2.0) runs entirely in
your browser, and **Web Speech** gives an instant in-editor preview. Cartesia and
ElevenLabs keys are optional, for premium cloud voices. On ElevenLabs free/Starter
plans the app falls back from `wav_44100` to `wav_24000` and resamples to 44.1 kHz
(Pro+ still gets native 44.1 kHz when allowed).

### 3. Initialize database

```bash
npm run db:push
```

Re-run this after pulling changes that touch `prisma/schema.prisma` (e.g.
`videoEngine` on projects, music fields) so your local SQLite stays in sync.

### 4. Optional demo seed

```bash
npm run seed:demo-brandkit
npm run seed:assets
```

### 5. Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Run with Docker (isolated)

For an isolated environment that keeps rendering (headless Chromium, FFmpeg,
native binaries, and CPU-heavy work) off your host machine, run the app in a
container. This covers both Remotion renders and HyperFrames
(`@hyperframes/producer` worker). Recommended if you want a hard boundary
between Reel Studio's external processes and your laptop. Node 22+ is required
in the image (already set in the Dockerfile).

**Prerequisites:** Docker Desktop (or Docker Engine + Compose v2) running.

```bash
# 1. Provide API keys (optional — you can also enter them in Settings later)
cp .env.example .env.local   # then edit values

# 2. Build and start (first run downloads the base image + installs deps)
docker compose up --build
```

Open `http://localhost:3000`. Source is bind-mounted, so edits hot-reload.

```bash
docker compose up        # start (after the first build)
docker compose down      # stop, keeping data
docker compose down -v   # stop and delete volumes (database, media, deps)
docker compose logs -f   # follow logs
docker compose exec app sh   # shell into the container
```

What the container handles for you:

- **Isolation & laptop health** — CPU/RAM are capped (conservative defaults in
  `docker-compose.yml`: ~2 cores, 6 GB) and render concurrency is limited via
  `REMOTION_RENDER_CONCURRENCY`. Tune these to your machine.
- **Linux-native deps** — `node_modules`, the Next.js build cache, the SQLite
  database and the `media/` store live in named volumes, never mixing with your
  host's (Windows/macOS) files. Your host `node_modules` is untouched.
- **Rendering** — Remotion and HyperFrames both use headless Chromium in-process
  / via the HyperFrames worker, with `--no-sandbox`, so no extra container
  privileges are required.

> First Remotion render downloads a headless Chromium build (~170 MB) into the
> deps volume; HyperFrames may download its own Chrome/FFmpeg on first use.
> Both are cached for subsequent renders.
>
> After changing dependencies or the `Dockerfile`, rebuild with
> `docker compose up --build`. If a dependency change isn't picked up, reset the
> deps volume: `docker compose down -v` then `docker compose up --build`.

## Available Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Build production app |
| `npm run start` | Run production app |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type-check |
| `npm run test` | Run Vitest suite |
| `npm run studio` | Open Remotion Studio |
| `npm run mcp` | Start the MCP server for AI tools (needs the app running + a token from Settings) |
| `npm run security:scan` | Scan tracked files for secret patterns |
| `npm run prepare:hooks` | Enable local git hooks in `.githooks` |
| `npm run db:push` | Push Prisma schema to SQLite |
| `npm run seed:assets` | Seed sample assets |
| `npm run seed:demo-brandkit` | Seed neutral demo brand kit |

## Architecture

![System architecture](docs/architecture.svg)

Key modules:

1. `src/app`:
API routes and pages using Next.js App Router.
Includes **Podcasts** (`/podcasts`) — a voice-only multi-speaker feature
separate from video projects (characters, AI/JSON scripts, ordered TTS stitch).
2. `src/library`:
Repository layer, render orchestration, storage abstraction, sample content.
HyperFrames export lives in `hyperframes-render.ts` (spawns the worker).
Podcast audio generation lives in `podcast-take-service.ts`.
3. `src/engines`:
Video-engine registry and adapters (`remotion` | `hyperframes`). Engine choice
is fixed on the project at create time.
4. `src/providers`:
Provider registries and concrete AI/voice implementations.
Podcast script prompts live in `ai/podcast-prompt.ts` (humanised dialogue).
5. `src/compositions`:
Remotion-only composition, templates, visuals, and tokens.
6. `scripts/hyperframes-render-worker.mjs`:
Isolated Node process that runs `@hyperframes/producer` for HyperFrames MP4s.
7. `prisma`:
Database schema and generated client usage.

## Render and Processing Flow

![Render flow](docs/render-flow.svg)

High-level sequence:

1. User edits scenes and selects/generates a voice take.
2. Timeline frames are computed from scene timings.
3. API creates render job and enqueues it.
4. Render path branches on `Project.videoEngine`:
   - **Remotion:** bundle composition and call `renderMedia`.
   - **HyperFrames:** build HTML composition, copy local takes/music into the
     project as relative `_assets/`, then spawn `hyperframes-render-worker.mjs`
     (isolated `@hyperframes/producer` session).
5. Progress is streamed to UI via SSE and persisted with throttling.
6. Final MP4 is written to `media/renders/` and linked in the renders library.

## Data Model (Summary)

- `Project`: top-level workspace; includes `videoEngine` (`remotion` | `hyperframes`, default `remotion`, set at create)
- `BrandKit`: palette, fonts, logo, handle, CTA defaults (fresh DBs get **Coral Harbor**)
- `Script`: timeline container with scenes; `voiceMode` (`oneshot` | `per_scene`); Style/Energy in brand overrides
- `Scene`: ordered unit with template, on-screen `text`, optional `spokenText`, and content (template ids differ per engine)
- `SceneVoiceClip`: per-scene voice versions used when `voiceMode` is `per_scene`
- `VoiceTake`: synthesized voice track + timing JSON (`source`: `oneshot` | `assembled`)
- `Render`: render job state and output path
- `Asset`: uploaded media metadata
- `ProviderSetting`: provider readiness and defaults

See `prisma/schema.prisma` for full schema details.

## Environment Variables

All supported variables are documented in `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma SQLite connection string |
| `CARTESIA_API_KEY` | No | Enable Cartesia voices and synthesis (Kokoro/Web Speech need no key) |
| `ELEVENLABS_API_KEY` | No | Enable ElevenLabs voices and synthesis (free tier supported via wav fallback) |
| `VOICEFORGE_SERVICE_URL` | No | Base URL for optional self-hosted VoiceForge cloning (`http://127.0.0.1:8089`) |
| `VOICEFORGE_API_TOKEN` | No | Optional bearer token when VoiceForge requires auth |
| `MCP_API_TOKEN` | No | Auto-managed; generate/rotate in Settings → AI tools / MCP (never set by hand) |
| `GEMINI_API_KEY` | No | Enable Gemini AI planning flows |
| `OPENAI_API_KEY` | No | Enable OpenAI AI planning flows |
| `UNSPLASH_ACCESS_KEY` | No | Enable AI-picked stock photo backgrounds (free Unsplash Demo tier) |
| `JAMENDO_CLIENT_ID` | No | Enable searching Jamendo's 600k+ Creative Commons track library from the Music control (free Client ID) |
| `REMOTION_RENDER_CONCURRENCY` | No | Override adaptive render concurrency (threads within one render) |
| `REEL_MAX_CONCURRENT_RENDERS` | No | Max render jobs running at once (default 1; protects small servers) |
| `SKIP_RENDER_SMOKE` | No | Skip render smoke test when set to `1` |

Minimum local setup for non-provider testing: only `DATABASE_URL`.

## Performance Notes

Render speed is hardware-dependent. Current backend defaults include:

- Adaptive capped concurrency for Remotion rendering
- Faster x264 preset for local throughput
- Render cache tuning for media and offthread video
- Throttled DB progress writes to avoid SQLite contention

You can override render concurrency with `REMOTION_RENDER_CONCURRENCY`.

## Security and Publishing Checklist

Before publishing:

1. Confirm no secrets are staged:

```bash
git status
git diff --staged
```

2. Confirm no local env files are tracked:

```bash
git ls-files .env .env.local
```

3. Run static quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run security:scan
```

4. Review [docs/LICENSING.md](docs/LICENSING.md) and sample assets for private or third-party licensed content (Remotion, Unsplash, music, VoiceForge engines).

5. Enable local pre-commit secret scanning:

```bash
npm run prepare:hooks
```

## Project Structure

```text
src/
  app/            # pages + API routes
  components/     # UI and editor components
  compositions/   # Remotion composition system
  engines/        # video engine registry (Remotion + HyperFrames)
  hooks/          # client data hooks
  lib/            # shared helpers and DTOs
  library/        # repositories, render service, storage
  providers/      # AI and voice provider adapters
  remotion/       # Remotion root registration
docs/             # product and architecture docs
prisma/           # schema and db setup
scripts/          # seed scripts + HyperFrames render worker
media/            # local asset and render output (git-ignored)
```

## Additional Docs

- **Licensing & third-party terms:** [`docs/LICENSING.md`](docs/LICENSING.md)
- Product build brief: `docs/ai-reel-studio-BRIEF.md`
- Security policy: `SECURITY.md`
- Contribution guide: `CONTRIBUTING.md`

