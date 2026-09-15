# Reel Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-24_LTS-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-server-blue.svg)](mcp/README.md)

**Turn a brief, script, screenshot, recording, or podcast into finished local content.**

Create Reels, Shorts, explainers, voiceovers, podcasts, and audiograms with a
guided production flow, six production presets, optional AI, and local media
rendering. Use the built-in **MCP server** for bounded unattended production.

Also supports Instagram, YouTube Shorts, TikTok, Facebook, X (Twitter), and
other social formats in **9:16**, **16:9**, and **1:1**.

> **Project status: 0.4 local production release.** The credential-free path,
> both render engines, SQLite-backed jobs, and the advertised 36-render example
> matrix are release-tested. Provider integrations remain optional and may
> evolve.

**MIT-licensed app. Local-first.** Projects and renders stay on your machine
unless you explicitly enable a cloud provider.

> App code is **MIT**. Projects may use **HyperFrames** (Apache-2.0) or
> **Remotion** (separate commercial terms, not OSI). See
> [Licensing](#licensing-summary) and [docs/LICENSING.md](docs/LICENSING.md).

<p align="center">
  <img
    src="docs/assets/reel-studio-editor.png"
    alt="Reel Studio editor showing scenes, video preview, voice controls and render options"
    width="1000"
  />
</p>

![Reel Studio demo](docs/assets/script-to-video.gif)

If Reel Studio helps your workflow, star the repository and tell us which
template or voice provider you want next.

[Quick start](#quick-start) · [Creator guide](docs/CREATOR_GUIDE.md) · [Walkthroughs](docs/WALKTHROUGHS.md) · [MCP](mcp/README.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

## 0.4 release coverage

The 0.4 roadmap contained 28 numbered tasks. The implemented release includes:

- synchronized Node, Next.js, Prisma, HyperFrames, Remotion, UI, and test
  dependency upgrades with fresh and populated-database migration checks
- versioned production specifications, a pinned 20-item HyperFrames catalog,
  shared engine inputs, and six presets rendered by both engines in three ratios
- deterministic and optional AI planning, safe public-page import, uploaded
  media, scene locks, hook alternatives, and selective regeneration
- editable caption tracks with timing provenance and SRT/VTT import/export
- reusable audio generation, podcast turn caching, intro/outro bumpers, explicit
  pauses, pronunciation rules, WAV/MP3 output, chapters, transcripts, and
  timestamp-grounded audiogram selection
- persistent production jobs, REST/MCP production interfaces, scoped tokens,
  format variants, partial-failure batches, diagnostics, and bundled examples

The detailed implementation audit is in
[docs/production/IMPLEMENTATION_AUDIT.md](docs/production/IMPLEMENTATION_AUDIT.md).
It records five areas that remain partial against the full roadmap: supervising
the web app and worker as one lifecycle, terminating active render processes on
cancel, performing real work in every named video pipeline stage, podcast
intro/outro and pronunciation controls with AI clip suggestions, and rendering
three different briefs for every preset during release acceptance.

### Current boundaries

- `npm run dev`, `npm run start`, and the current Docker app service start the
  web process. Run `npm run production:worker` as a second process for continuous
  unattended queue processing. Request handlers also make a best-effort attempt
  to process newly submitted work.
- The scene editor can search configured Unsplash, Pexels, and Pixabay providers
  by media kind and orientation, preview attribution, and select, replace, or
  clear stock backgrounds. Pexels and Pixabay selections are cached locally;
  compliant Unsplash URLs remain hotlinked. Coverr stays disabled behind its
  unresolved license gate. Scene and AI creation controls support
  `auto/image/video/none`; automatic selection uses stable candidate choice and
  provider fallback while preserving explicit uploads, URLs, and selections.
  Stock videos render muted with deterministic scene timing and cover crops in
  both engines, and output records retain their source attribution snapshots.
- AI planning currently supports Gemini and OpenAI. Ollama and LM Studio are
  planned; the deterministic no-key planner remains available.
- Caption text and timing are editable. Font, position, box, outline, karaoke,
  and other caption appearance controls are planned.
- The catalog is pinned for reproducible saved projects. It does not
  automatically track the full upstream HyperFrames registry.
- Reel Studio does not call generative-video APIs or run model-produced code.

## Who is this for?

Reel Studio is designed for:

- Developers building programmable video workflows
- Creators who want local control over projects and rendering
- Teams experimenting with AI-assisted content production
- AI-agent users who want to generate videos and podcasts through MCP

## From idea to video

1. Choose video, voiceover, podcast, or audiogram
2. Paste a brief or script, import a public page, or upload local media
3. Choose one of six production presets, a brand kit, voice, and canvas
4. Review the deterministic or AI-assisted draft and lock approved material
5. Produce locally and download verified media, captions, and transcripts

## Example outputs

| Format                                          | Preview                                                                                          | File                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Portrait 9:16 (Reels, Shorts, TikTok, Stories)  | [![Portrait](docs/assets/examples/portrait-demo.jpg)](docs/assets/examples/portrait-demo.mp4)    | [MP4](docs/assets/examples/portrait-demo.mp4)  |
| Landscape 16:9 (YouTube, X, LinkedIn, Facebook) | [![Landscape](docs/assets/examples/landscape-demo.jpg)](docs/assets/examples/landscape-demo.mp4) | [MP4](docs/assets/examples/landscape-demo.mp4) |
| Square 1:1 (Instagram, Facebook feed)           | [![Square](docs/assets/examples/square-demo.jpg)](docs/assets/examples/square-demo.mp4)          | [MP4](docs/assets/examples/square-demo.mp4)    |

**Podcast sample:** [MP3](docs/assets/examples/podcast-demo.mp3)

## What you get

### Create

- Four-step production wizard plus the full scene editor
- Deterministic no-key planning and optional Gemini / OpenAI planning
- Product Launch, Editorial Explainer, Creator Punch, Data Story, Developer Demo,
  and Cinematic Brand presets
- Native portrait, landscape, and square layouts in both engines
- Uploaded media, bounded public-page text import, or optional Pexels, Pixabay,
  and Unsplash image/video backgrounds

### Voice

- Browser Kokoro (Apache-2.0, no key) and Web Speech preview
- Cartesia and ElevenLabs (optional keys)
- Optional self-hosted [VoiceForge](https://github.com/mohitkale/voiceforge)
- Full-reel or per-scene takes, plus cached **solo, two-host, and interview podcasts**
- Selective podcast turn regeneration, pronunciation rules, explicit pauses,
  intro/outro bumpers, production WAV/MP3, transcript and chapter exports
- One-click portrait, square, or landscape **audiograms** from manually selected
  or timestamp-grounded suggested turns
- Durable JSON batches with independent portrait, square and landscape reflows, partial-failure recovery and downloadable bundles

### Design

- Motion templates for Remotion and HyperFrames
- Brand kits, editable SRT/VTT captions, background music (bundled CC0)
- Style and Energy looks (for example clean story, bold hook)

### Export and automate

- Local MP4 rendering with queue and progress
- SQLite-backed jobs with leases, recovery, bounded batches, cancellation requests,
  and verified artifacts
- Docker isolation bound to `127.0.0.1`
- **MCP server** for AI-assisted video and podcast workflows ([mcp/README.md](mcp/README.md))

## Video engines

|           | HyperFrames                            | Remotion                      |
| --------- | -------------------------------------- | ----------------------------- |
| Licence   | **Apache-2.0**                         | Remotion License (not OSI)    |
| Templates | HTML motion (`hf-*`)                   | React compositions            |
| Best for  | Apache-2.0 workflows, demos, and forks | Rich React template ecosystem |

See [docs/VIDEO_ENGINES.md](docs/VIDEO_ENGINES.md).

## Local vs optional cloud

| Feature          | Local option                              | Optional cloud            |
| ---------------- | ----------------------------------------- | ------------------------- |
| Voice preview    | Web Speech                                | n/a                       |
| Voice generation | Kokoro / VoiceForge                       | ElevenLabs, Cartesia      |
| Video render     | HyperFrames or Remotion (on your machine) | n/a                       |
| AI planning      | Manual                                    | Gemini, OpenAI            |
| Backgrounds      | Upload / gradients                        | Pexels, Pixabay, Unsplash |
| Music            | Bundled CC0 / upload                      | Jamendo                   |

Caption timing can come from an imported SRT/VTT file, provider timing, or the
scene timeline. For optional offline speech alignment, install
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) and set
`WHISPER_CPP_BIN` plus `WHISPER_CPP_MODEL` in `.env.local`. The caption editor
and deterministic timing work without whisper.cpp.

Caption appearance currently uses the preset-safe renderer defaults. The next
planned release adds user-facing typography, placement, background, outline,
word-count, highlighting, and karaoke controls shared by both engines.

See [docs/LOCAL_FIRST.md](docs/LOCAL_FIRST.md).

## Quick start

```bash
git clone https://github.com/mohitkale/reel-studio.git
cd reel-studio
nvm use          # Node 24 LTS
npm install
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For continuous unattended production, start the worker in a second terminal:

```bash
npm run production:worker
```

Or run `npm run demo` (setup + dev server). No cloud keys are required for the
seeded HyperFrames demo or Kokoro voices. Open **Gallery** for bundled examples,
or run `npm run sample:export` for a credential-free local MP4. Run
`npm run doctor` whenever you want to verify the production runtime.

### Manual fallback

```bash
cp .env.example .env.local
npm run db:migrate
npm run seed:demo-brandkit
npm run seed:demo-project
npm run seed:demo-podcast
npm run seed:gallery
npm run dev
```

### Docker

```bash
cp .env.example .env.local   # optional keys
docker compose up --build
```

Compose publishes **`127.0.0.1:3000` only** (not your LAN).
For continuous queue processing in the current development compose setup, run
`docker compose exec app npm run production:worker` in another terminal.

## MCP integration

With the app running, generate a legacy approval token or a named scoped token in
**Settings → AI tools / MCP**, then:

```bash
npm run mcp
```

Video and podcast tools: [mcp/README.md](mcp/README.md).

## Security

Built for trusted localhost use. Do not expose it on the public internet without
your own auth layer. See [SECURITY.md](SECURITY.md).

## Roadmap

The current production release includes six cross-engine presets, editable
caption timing and text, persistent jobs, podcast and audiogram workflows,
scoped MCP automation, and format-aware batches. The reviewed next phase is in
[docs/LOCAL_FIRST_EXPANSION.md](docs/LOCAL_FIRST_EXPANSION.md), split into eight
sequential PRs for separate implementation sessions; no implementation of that
phase has started. Follow longer-term work in [ROADMAP.md](ROADMAP.md).

## Contributing

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CONTRIBUTORS.md](CONTRIBUTORS.md)

### Contributors

- **[Mohit Kale](https://github.com/mohitkale)**: creator and maintainer
- **[Cursor](https://cursor.com)** / **[Cursor Agent](https://github.com/cursoragent)**: pair programmer and first AI contributor

## Architecture

![System architecture](docs/architecture.svg)

![Render flow](docs/render-flow.svg)

Stack: Next.js App Router, TypeScript, Prisma + SQLite, Remotion and/or
HyperFrames, TanStack Query, Zod.

### Key modules

1. `src/app`: pages and API routes (including `/podcasts`)
2. `src/library`: repositories, render and take services, storage
3. `src/engines`: Remotion / HyperFrames adapters
4. `src/providers`: AI and voice providers
5. `src/compositions`: Remotion templates
6. `scripts/`: setup, seeds, HyperFrames worker

## Available scripts

| Script                                        | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `npm run setup`                               | First-run setup (safe to re-run)            |
| `npm run demo`                                | Setup + start dev server                    |
| `npm run doctor`                              | Check the local production runtime          |
| `npm run sample:export`                       | Render a credential-free sample MP4         |
| `npm run release:check`                       | Run the fast 0.4 release contract checks    |
| `npm run release:matrix`                      | Render all 36 preset/engine/format outputs  |
| `npm run dev`                                 | Start development server                    |
| `npm run build` / `start`                     | Production build / run                      |
| `npm run production:worker`                   | Continuously process the persistent queue   |
| `npm run lint` / `typecheck` / `test`         | Quality checks                              |
| `npm run security:scan`                       | Secret pattern scan                         |
| `npm run prepare:hooks`                       | Enable `.githooks`                          |
| `npm run db:migrate`                          | Safely apply versioned database migrations  |
| `npm run seed:gallery`                        | Install bundled examples into local media   |
| `npm run seed:demo-project`                   | Seed HyperFrames demo reel                  |
| `npm run seed:demo-podcast`                   | Seed short demo podcast                     |
| `npm run test:podcast-audiogram -- <take-id>` | Render and verify a podcast-to-video sample |
| `npm run seed:demo-brandkit`                  | Seed Coral Harbor brand kit                 |
| `npm run seed:assets`                         | Sample SVG/Lottie assets                    |
| `npm run import:hf-catalog`                   | Re-import the currently pinned HF selection |
| `npm run mcp`                                 | MCP server                                  |
| `npm run studio`                              | Remotion Studio                             |

## Environment variables

See [`.env.example`](.env.example). Minimum for local use without cloud
providers: `DATABASE_URL` (created by setup).

## Licensing summary

| Component                                                            | Terms                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Reel Studio app, templates, MCP code                                 | **MIT**                                                            |
| Bundled music (`public/music/`)                                      | **CC0**                                                            |
| **Remotion**                                                         | **Remotion License** ([details](https://www.remotion.dev/license)) |
| **HyperFrames**                                                      | **Apache-2.0**                                                     |
| Kokoro TTS                                                           | Apache-2.0                                                         |
| Optional cloud providers                                             | Each vendor's terms                                                |
| VoiceForge engines ([repo](https://github.com/mohitkale/voiceforge)) | Per-engine (may be non-commercial)                                 |

Full matrix: **[docs/LICENSING.md](docs/LICENSING.md)**.

## More docs

- [docs/LOCAL_FIRST.md](docs/LOCAL_FIRST.md)
- [docs/CREATOR_GUIDE.md](docs/CREATOR_GUIDE.md)
- [docs/WALKTHROUGHS.md](docs/WALKTHROUGHS.md)
- [docs/VIDEO_ENGINES.md](docs/VIDEO_ENGINES.md)
- [docs/VOICE_PROVIDERS.md](docs/VOICE_PROVIDERS.md)
- [docs/TEMPLATE_AUTHORING.md](docs/TEMPLATE_AUTHORING.md)
- [docs/LICENSING.md](docs/LICENSING.md)
- [docs/production/IMPLEMENTATION_AUDIT.md](docs/production/IMPLEMENTATION_AUDIT.md)
- [docs/LOCAL_FIRST_EXPANSION.md](docs/LOCAL_FIRST_EXPANSION.md)
- [CHANGELOG.md](CHANGELOG.md)

### Production regression checks

`npm run test:unit` runs credential-free unit tests. `npm run test:render`
renders a legacy fixture through both engines. `npm run test:stock-video-render`
generates a credential-free local video with an audio track, renders it muted
through both engines in portrait, landscape, and square, and verifies codec,
dimensions, duration, visible content, and absence of leaked stock audio.
`npm run release:matrix` renders all six presets through both engines in all
three layouts. Artifacts stay under `.artifacts/`; the manual Quality workflow
retains them for inspection. Rendering requires Chromium and may download it
during initial setup. Composition fonts and motion runtime files are bundled
locally before frame rendering.

### Database upgrades

Stop the app before running `npm run db:migrate`. Existing recognized v0.3.0 databases are backed up beside the SQLite file and baselined before versioned migrations run. Unknown schemas are rejected. Relative `file:./dev.db` URLs continue to resolve under `prisma/`. To roll back, stop the app, restore the matching backup and application version together, and keep the media directory. Setup and Docker use this migration path.

### Supervised production worker

`npm run dev` and `npm run start` launch Next.js and the durable production worker
under one supervisor. Build first with `npm run build` for production. Docker
uses the same launcher. Both processes inherit the same Next.js environment
configuration and SQLite URL. Do not launch another worker for the normal setup.
Worker crashes are logged and restarted with bounded backoff (five attempts);
a web crash or exhausted restart budget stops the pair with a nonzero exit.
Ctrl+C/SIGTERM stops both, with a ten-second forced shutdown bound. Durable
leases recover interrupted local rendering. Shutdown requeues local video jobs
with their saved stages; interrupted audio/provider jobs require explicit retry
to avoid repeating an uncertain paid request. `npm run production:worker` remains available
for explicitly managed deployments; routes retain their fallback when the app
is launched directly without the supervisor.

Video production jobs capture an immutable script/engine/brand/caption/take
snapshot at submission. Selected local assets are preserved under
`media/production-assets/` with content hashes; remote stock URLs remain network
sources. Each stage saves a validated output and invalidation key in the existing
SQLite job-step records. Retries reuse valid stages and verified renders, and
never synthesize a new paid voice implicitly. Existing queued video inputs are
snapshotted on their first execution; older projects and REST/MCP requests retain
their current formats.

Run `npm run test:production-worker` for isolated real exports and active
cancellation through both engines. It creates a fresh test database and evidence
under `.artifacts/`, checks every persisted stage, and verifies renderer children
and partial output files are gone after cancellation. It uses installed local
rendering tools and does not modify existing project rows.

The Docker image includes `procps` for renderer process-tree cleanup and `unzip`
for Chromium archive extraction. Its default command starts the supervisor directly
so container stop signals reach both children. It uses the existing CPU Kokoro provider and
skips optional ONNX CUDA binary downloads during dependency installation. It does not install GPU
drivers or change host configuration.
