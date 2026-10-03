# Reel Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-24_LTS-brightgreen.svg)](https://nodejs.org/)
[![Quality](https://github.com/mohitkale/reel-studio/actions/workflows/quality.yml/badge.svg)](https://github.com/mohitkale/reel-studio/actions/workflows/quality.yml)
[![MCP](https://img.shields.io/badge/MCP-server-blue.svg)](mcp/README.md)

**Your idea → animated video → downloadable MP4. On your machine.**

Make Reels, Shorts, explainers, voiceovers, podcasts, and audiograms from your
scripts and media. Choose a look, generate, then edit or remix the result.
The first video needs **no AI key or voice-model download**.

[![Reel Studio: current creation screen, animated export, and downloadable result](docs/assets/script-to-video.gif)](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0)

_Demo: real v0.4.0 screens and a locally rendered export. [Watch the full sample](https://github.com/mohitkale/reel-studio/releases/download/v0.4.0/reel-studio-0.4.0-editorial-explainer-landscape.mp4)._

[Get started](#quick-start) · [Creator guide](docs/CREATOR_GUIDE.md) · [Documentation](docs/README.md) · [Contribute](CONTRIBUTING.md)

## What you can make

- **Videos:** six visual presets, sixteen authored motion treatments, your own
  screenshots or footage, and portrait **9:16**, landscape **16:9**, or square **1:1** output.
- **Voiceovers and captions:** optional local Kokoro, configurable voice providers,
  editable captions, and SRT/VTT import and export.
- **Podcasts:** solo, two-host, or interview scripts; reusable speech turns;
  WAV/MP3, transcripts, chapters, and video audiograms.
- **Repeatable production:** saved jobs, progress that survives refresh,
  cancellation and retry, format variants, and batches.
- **AI-assisted workflows:** optional local/cloud planning and a scoped
  [MCP server](mcp/README.md) for your coding agent or automation.

Projects, uploads, and outputs stay local. Configured cloud providers receive
only the data needed for the features you choose. See [local-first behavior](docs/LOCAL_FIRST.md).

## Quick start

Install **Node 24 LTS** (minimum 24.15), **FFmpeg/FFprobe**, and a supported
Chrome/Chromium browser. See [setup and troubleshooting](docs/SETUP.md).

```bash
git clone https://github.com/mohitkale/reel-studio.git
cd reel-studio
nvm use
npm ci
npm run setup
npm run dev
```

Open **[localhost:3000](http://localhost:3000)**:

1. Paste your script or a few clear ideas.
2. Choose a preset and format; leave narration off for your first export.
3. Select **Generate**, play the finished result, and **Download MP4**.
4. Choose **Edit video** to customize scenes, voice, captions, and branding—or **Remix** to try another look.

The launcher runs both the app and its production worker. `npm run doctor`
checks your runtime; `npm run sample:export` creates a bundled local example.
Kokoro downloads and caches model weights on first synthesis if needed.

**Upgrading?** [v0.4.0 upgrade notes](docs/RELEASE_0.4.0.md) cover backups,
migrations, preserved media, and the move to HyperFrames-only rendering.

## Choose a look

| Preset              | Use it for                                                   |
| ------------------- | ------------------------------------------------------------ |
| Product Launch      | Product screenshots, features, proof, and calls to action    |
| Editorial Explainer | Headlines, steps, diagrams, and attributed quotes            |
| Creator Punch       | Hooks, short tips, emphasis, and a clear payoff              |
| Data Story          | Your supplied metrics, labeled comparisons, and charts       |
| Developer Demo      | Code, terminal output, diffs, and browser proof              |
| Cinematic Brand     | Supplied photography/footage, brand stories, and logo closes |

Charts use supplied values. Review optional AI-generated claims before publishing.

![Prompt-first creation with six visual presets](docs/assets/reel-studio-home.png)

## Local tools and optional providers

| Feature                | Local choices                               | Optional cloud choices             |
| ---------------------- | ------------------------------------------- | ---------------------------------- |
| Planning               | Deterministic, Ollama, LM Studio, llama.cpp | Gemini, OpenAI                     |
| Narration              | Kokoro, self-hosted VoiceForge              | ElevenLabs, Cartesia               |
| Backgrounds            | Your uploads, animated backgrounds          | Pexels, Pixabay, Unsplash previews |
| Music                  | Bundled CC0 tracks, your uploads            | Jamendo                            |
| Preview and MP4 export | HyperFrames                                 | —                                  |

Provider keys are optional. Local AI servers are configured separately; Reel
Studio does not install their models. Unsplash export staging and Coverr remain
license-gated. [Provider and asset terms](docs/LICENSING.md) apply.

## Explore and contribute

- Follow the [walkthroughs](docs/WALKTHROUGHS.md) or explore the app's **Gallery**.
- Read the [architecture](docs/ARCHITECTURE.md), [template guide](docs/TEMPLATE_AUTHORING.md),
  and [provider/block extension guide](docs/EXTENSIONS.md).
- Report a reproducible bug, improve a guide, add a template or provider, or
  submit a focused PR. Start with [CONTRIBUTING.md](CONTRIBUTING.md).
- See what's shipped and what's next in the [changelog](CHANGELOG.md) and [roadmap](ROADMAP.md).
- If Reel Studio helps you, **star, watch, or fork the repository** and share what you make.

Built by **[Mohit Kale](https://github.com/mohitkale)** with
**[Cursor Agent](https://github.com/cursoragent)** and
**[OpenAI Codex](https://github.com/codex)**. See [contributors](CONTRIBUTORS.md).

## Security and licensing

- Designed for a **trusted, single-user local account**; bind defaults are loopback.
  Remote/multi-user hosting needs additional authentication and isolation.
  Read [SECURITY.md](SECURITY.md).
- App code is **MIT**; HyperFrames is **Apache-2.0**.
- The speech phonemizer includes a **GPL-3.0-or-later** engine. Its matching
  source archive and notices accompany [v0.4.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0).
- GSAP, fonts, model weights, providers, and media retain their own terms.
  See the complete [licensing inventory](docs/LICENSING.md).
