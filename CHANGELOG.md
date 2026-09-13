# Changelog

All notable changes to Reel Studio are documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

## 0.4.0 - 2026-09-13

### Added

- Four-step production wizard for text, bounded public-page imports, and uploaded image, video, or audio sources
- Six versioned production presets across HyperFrames and Remotion: Product Launch, Editorial Explainer, Creator Punch, Data Story, Developer Demo, and Cinematic Brand
- Durable SQLite-backed production and batch jobs with progress events, leases, recovery, cancellation, retries, artifact verification, and independently reflowed format variants
- Editable caption tracks with SRT/VTT import and export, timing provenance, and optional local whisper.cpp transcription
- Solo, two-host, and interview podcast presets with turn caching, selective regeneration, WAV/MP3, transcripts, chapters, and audiograms
- Shared REST/MCP production schemas, scoped automation tokens, provider and duration limits, approval controls, and downloadable output bundles
- Local diagnostics, curated output gallery, creator guide, reproducible walkthroughs, and credential-free sample export

### Changed

- Upgraded all compatible direct packages and standardized the supported runtime on Node.js 24 LTS
- Upgraded HyperFrames producer to 0.8.33 and synchronized all Remotion packages at 4.0.523
- Replaced `db push` upgrades with recognized, backed-up, versioned SQLite migrations
- Snapshotted preset, catalog, brand, media, timing, and renderer metadata so saved output remains reproducible
- Centralized audio mixing, narration reuse, subtitles, safe areas, and engine-independent production planning

### Fixed

- Prevented missing chart values, invented proof, catalog placeholders, and executable substitutions from entering automatic productions
- Made HyperFrames timelines seekable with stable instance IDs and matching preview/export inputs
- Bundled render fonts and motion runtime assets locally so frame rendering does not fetch them from remote CDNs
- Preserved successful batch outputs and unchanged podcast or scene audio across partial regeneration and retry

### Security

- Blocked public-page ingestion from loopback, local, and private network destinations after every redirect
- Enforced production scopes and paid-provider limits across both current and compatibility API routes

See [the upgrade notes](docs/production/UPGRADES.md) and [release validation](docs/production/RELEASE_VALIDATION.md).

## 0.3.0 - 2026-08-06

### Added

- HyperFrames Director: HF-aware AI templates, one-click auto soundtrack, sparse SFX cues, and Produce reel API/UI
- Bundled cinematic CC0 SFX pack (`npm run gen:sfx`) with Music panel regenerate/toggle controls
- Kokoro speaking `speed` on server and browser paths
- Seed scripts for Next.js 16.3 and Before/After AI psychology demo reels

### Changed

- Default video engine is HyperFrames
- Catalog stages paint Unsplash photo beds when present; richer native motion (ambient GSAP, count-up proofs, dark cinematic money/chart stages)
- Prisma Script model includes `sfxEnabled` / `sfxJson` (run `npx prisma db push` after upgrade)

## 0.2.0 - 2026-08-05

### Added

- Curated HyperFrames catalog blocks (kinetic slam, money count, data chart, app showcase, social/logo outros) with portrait-native preview visuals
- Full Kokoro 82M voice catalog (54 voices) with language groups and a Settings whitelist
- Multilingual Kokoro voice support on server and browser paths (including Hindi voice bins)
- Interview LinkedIn seed scripts and dialogue-aware VO gap timing for multi-character casting

### Changed

- HyperFrames composition and template mapping updated for the curated catalog path
- Docs for video engines, template authoring, and voice providers

## 0.1.0 - 2026-07-24

First public GitHub release.

### Added

- Local-first short-form video studio (Remotion and HyperFrames engines)
- Multi-provider voice (Kokoro, Web Speech, Cartesia, ElevenLabs, VoiceForge)
- Audio podcasts with multi-speaker TTS
- MCP server for AI-assisted video and podcast workflows
- `npm run setup` and `npm run demo` for first-run onboarding
- Demo video/podcast seeds and sample outputs in the README
- Open-source launch docs: local-first model, video engines, voice providers
- Community files: roadmap, code of conduct, issue and PR templates
- Security hardening for localhost-first operation (`127.0.0.1` Docker bind)

### Changed

- README restructured around product promise, workflow, and visuals
- Speculative upcoming-features list replaced by [ROADMAP.md](ROADMAP.md)
