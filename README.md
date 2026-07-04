# Reel Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Reel Studio is an open-source, local-first short-form video editor** for building portrait, landscape, or square videos end to end.

- Choose a video orientation per project (portrait 9:16, landscape 16:9, square 1:1)
- Script and scene editing
- AI scene planning that selectively adds relevant Unsplash stock backgrounds with varied pan/zoom motion (optional, needs an Unsplash key)
- AI voice takes (pluggable providers)
- Motion templates powered by Remotion (Lottie and Three.js support)
- MP4 rendering with queue and progress updates
- Project, asset, and brand-kit management

The app runs as a single Next.js project with API routes and UI in one codebase.

## Open-Source

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. All local tools and components are open-source, including:

- **Kokoro TTS** - Apache-2.0 licensed, runs entirely in-browser
- **MCP Server** - Open-source Model Context Protocol integration
- **All custom components and templates** - MIT licensed

We believe in transparent, community-driven development. Contributions are welcome!

## Available Features

### Video Creation
- **Multi-format support**: Portrait (9:16), Landscape (16:9), Square (1:1)
- **Script and scene editing**: Scene-by-scene content creation
- **AI scene planning**: Automatically adds relevant Unsplash stock backgrounds with varied pan/zoom motion
- **Motion templates**: Powered by Remotion with Lottie and Three.js support
- **7 professional templates**: Kinetic typography, Lottie explainer, 3D accents, emoji punch, icon grid, quote cards, stat reveal
- **MP4 rendering**: Queue-based rendering with progress updates
- **Project management**: Organize projects, assets, and brand kits

### Voice & Audio
- **Multiple voice providers**:
  - **Kokoro** (Apache-2.0): Free, runs entirely in-browser, no API key needed
  - **Web Speech API**: Instant in-editor preview, no API key needed
  - **Cartesia**: Premium cloud voices with cloning support
  - **ElevenLabs**: Premium cloud voices with extensive library
- **Voice takes management**: Generate, compare, and select multiple takes
- **Caption sync**: Automatic timing alignment with voiceover
- **Background music**: Support for royalty-free audio tracks

### AI Integration
- **AI scene generation**: Powered by Google Gemini or OpenAI
- **MCP Server**: Model Context Protocol integration for AI tools
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
- Video: Remotion 4 (`@remotion/renderer`, `@remotion/lottie`, `@remotion/three`)
- Persistence: Prisma + SQLite
- Storage: Local disk asset store under `media/`
- Tooling: ESLint, Prettier, Vitest

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Set only the keys you need. Empty values are fine for local non-provider testing.
Free, no-key voices work out of the box: **Kokoro** (Apache-2.0) runs entirely in
your browser, and **Web Speech** gives an instant in-editor preview. Cartesia and
ElevenLabs keys are optional, for premium cloud voices.

### 3. Initialize database

```bash
npm run db:push
```

Re-run this after pulling changes that touch `prisma/schema.prisma` (e.g. the
background-music fields) so your local SQLite stays in sync.

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

For an isolated environment that keeps rendering — headless Chromium, FFmpeg,
native binaries and CPU-heavy work — off your host machine, run the app in a
container. This is recommended if you want a hard boundary between Reel Studio's
external processes and your laptop.

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
- **Rendering** — Remotion's headless Chromium (downloaded on first render) runs
  with `--no-sandbox`, so no extra container privileges are required.

> First render downloads a headless Chromium build (~170 MB) into the deps
> volume; it is cached for subsequent renders.
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
2. `src/library`:
Repository layer, render service, storage abstraction, sample content.
3. `src/providers`:
Provider registries and concrete AI/voice implementations.
4. `src/compositions`:
Remotion composition, templates, visuals, and tokens.
5. `prisma`:
Database schema and generated client usage.

## Render and Processing Flow

![Render flow](docs/render-flow.svg)

High-level sequence:

1. User edits scenes and selects/generates a voice take.
2. Timeline frames are computed from scene timings.
3. API creates render job and enqueues it.
4. Render service bundles/selects composition and calls `renderMedia`.
5. Progress is streamed to UI via SSE and persisted with throttling.
6. Final MP4 is written to `media/renders/` and linked in the renders library.

## Data Model (Summary)

- `Project`: top-level workspace for scripts and branding
- `BrandKit`: palette, fonts, logo, handle, CTA defaults
- `Script`: timeline container with scenes
- `Scene`: ordered unit with template and content
- `VoiceTake`: synthesized voice track + timing JSON
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
| `ELEVENLABS_API_KEY` | No | Enable ElevenLabs voices and synthesis |
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

4. Review docs and sample assets for private or licensed content.

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
  hooks/          # client data hooks
  lib/            # shared helpers and DTOs
  library/        # repositories, render service, storage
  providers/      # AI and voice provider adapters
  remotion/       # Remotion root registration
docs/             # product and architecture docs
prisma/           # schema and db setup
scripts/          # local seed scripts
media/            # local asset and render output (git-ignored)
```

## Additional Docs

- Product build brief: `docs/ai-reel-studio-BRIEF.md`
- Security policy: `SECURITY.md`
- Contribution guide: `CONTRIBUTING.md`

