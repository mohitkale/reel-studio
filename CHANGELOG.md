# Changelog

All notable changes to Reel Studio are documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

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
