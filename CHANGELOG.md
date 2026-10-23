# Changelog

All notable changes to Reel Studio are documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

## 0.7.0

### Added

- Responsive creation hub and dedicated voiceover workspace, shared speech
  presets, pronunciation previews, take comparison and reviewed voice batches.
- Scene/create/delete/reorder and script-setting undo/redo across reloads,
  including grouped editor AI changes and restored clip/stock relationships.
- Saved waveform edit plans, cut/gain/cleanup controls and edited takes usable
  in video and podcast exports without replacing source audio.
- Local recording/import, optional Whisper transcripts, editable transcript
  review, and episode packages with shared-audio preservation.
- Reviewed manual or optional AI language versions in separate projects.
- Editable multi-series chart grids, text entrance timing, safe-zone guides,
  preview selection, series/archive filters and a central factory workspace.

### Fixed

- Asset deletion protects current content, frozen revisions/jobs/profiles,
  finishing snapshots and saved history. Edited video takes preserve intentional
  omissions; their timeline labels explain omitted scenes.
- Microphone permission waits are explicit and cancelable; canceled or unmounted
  requests release late streams. Audio plan revision conflicts retain saved work.

### Upgrade

- Three additive studio migrations since v0.6.0. Existing databases use the
  backup-aware `npm run db:migrate`; dependency pins are unchanged. Local Whisper
  remains optional and needs an explicitly supplied/downloaded model.
  See [upgrade and rollback](docs/RELEASE_0.7.0.md).

## 0.6.0

### Added

- Six adaptive recipes with density/aspect/timing resolution, persisted film-plan
  checkpoints, bounded sequence direction and recurring subject identity.
- Contact sheets, draft animatics, scoped variations with guarded undo, and
  optional local readiness diagnostics in the creation workflow.
- Explicit chapter goals, examples and recap callbacks for lessons up to ten
  minutes; normal and chaptered video retain their existing duration limits.
- Versioned series profiles, resumable factory batches, frozen aspect/cutdown
  revisions with lineage, and pinned bundled data/asset packs.
- Retrospective M0 corpus: twelve paired v0.5.0/current films, capability inventory,
  review rubric, output checksums and decoded comparisons. Human preference
  targets remain unmeasured.

### Fixed

- Data Story's native chart fallback preserves a supplied background image
  together with source copy, chart values and attribution in all three formats.

### Upgrade

- One additive factory-workflow migration; no dependency or model changes.
  See [upgrade and rollback](docs/RELEASE_0.6.0.md).

## 0.5.0

### Fixed

- Windows CI uses a pinned, SHA-256-verified FFmpeg archive instead of depending
  on the unavailable Chocolatey package feed. All existing checks remain required.
- AI creation uses the content palette by default instead of silently inheriting
  the saved default brand. Explicit brand kits remain available in the creation
  dialog and keep their colours; existing projects retain saved designs.
- Lunar/calendar and celestial subjects receive animated phases, seasonal wheels
  and orbital illustrations with a Celestial almanac palette.

- Create with AI aligns the Visual direction and Orientation controls at the
  same height. Development AI provider factories refresh after prompt/schema
  changes instead of retaining stale closures.
- Export preparation and media localization retain narration used by semantic
  illustrations. Isolated scene previews use the current full-story context,
  matching full-reel playback and MP4 output.
- Gemini video planning sends the nested director/chart JSON Schema through
  `responseJsonSchema`, resolving the `additionalProperties` HTTP 400 error.
- Automatic stock selection uses exportable Pexels/Pixabay media and animated
  fallbacks rather than selecting Unsplash hotlinks that cannot be staged for MP4.
- Quick Produce retains the configured AI planner when enabled; local planning
  is explicit, and narration is a visible choice.
- Editor export progress, completion, and failure links remain visible beside
  Export MP4 instead of being hidden inside Customize video.
- Compatible authored motion takes precedence over an AI layered-title fade.
  Editorial fallback scenes respect the saved brand palette, with readable text
  paints for solid backgrounds and accent badges.
- The development background worker reloads renderer imports alongside the web
  preview, preventing stale MP4 designs after source edits.
- Prose no longer fills unsupported quote/diagram slots. Explicit transition
  endpoints can form a comparison without inventing labels or values.
- A grounded chart with prose copy keeps its chart layout. Explicit chart
  requests can use a literal supplied dataset when AI returns only prose.
- Template previews include illustrative chart data and list items.

### Added

- Six automatic story-motion showpieces: Depth reveal, Orbit & compare,
  Growing hierarchy, Signal architecture, Work in motion and Product evolution.
  Dimensional scenes develop over the narration beat, with shared subject
  identities, vector action and sparse event-timed sound accents. The gallery
  includes live previews with sound; existing treatments and layouts remain.
- Natural team/system narration produces connected structures, with bounded
  parent relationships and source-grounded process labels. Prepared renders
  retain measured word text and explicit SFX fades; revisions and sound editing
  preserve the new frozen direction and cues.

- Automatic concept, comparison, overlap and process illustrations with semantic vector
  subjects, source-grounded labels and continuity across story definitions.
  Complete beats and concise headlines replace the default long sequence of
  short sentence slides. Existing authored treatments remain available.
- Seven authored motion treatments: Editorial spread, Colour-field poster, Focus
  window, Cascading list, Tile grid, Metric ledger and Gallery mat, bringing the
  library to 23. Each uses separate composition and seek-safe choreography.
- Automatic coherent motion families for new drafts, content compatibility and
  recent-history variation; optional Editorial/Graphic/Precision family controls
  in Visual direction. Saved scene choices, revisions and locks remain intact.
- Live motion previews in Templates, deterministic fitting for new compositions,
  dense square-list layouts and list/data reading-time advice in Visual review.

### Changed

- AI creation defaults to Automatic direction: content selects a preset family
  and a frozen, readable theme instead of reusing one coral palette. AI can
  choose style and energy; explicit presets, style choices, custom brand kits
  and scene locks remain authoritative. AI motion suggestions are hints for
  sequence planning, rather than user locks.
- Calm energy favours measured openings; explicit Showcase and scene locks
  preserve deliberately bold treatments.
- Projects leads with Create with AI and Create production. Blank projects stay
  beside the library; the text-only prompt flow is retained for remix.
- AI creation uses preset defaults with optional style/media customization.
  Local production starts with content and can build immediately with automatic
  naming, while retaining the full customization workflow.
- The editor opens the full reel and exposes Visual direction and Visual review
  beside Export MP4. Expressive direction includes type treatments for prose,
  stronger saved-emphasis hierarchy, animated structural details, and larger
  reading text. Clean retains quieter layouts; locked scenes remain protected.

### Documentation

- Shorter README with a current screen/export demo and contribution paths.
- Indexed current setup, runtime, editing, and extension guides; completed plans
  and audits are labeled historical.
- Proportionate local verification, coherent release batches, and preserved agent
  co-authorship are documented for contributors and coding agents.

## 0.4.0 — 2026-10-03

### Added

- Prompt-first creation with six visual presets, downloadable results, remix,
  mobile layouts and an editable scene timeline.
- Versioned motion specifications, a deterministic compiler and sixteen authored
  treatments with offline preview/export seeks, responsive copy and brand tokens.
- Source-grounded deterministic direction and constrained AI direction over the
  same schema, explicit paid-call budgets and bounded visual repair.
- Typed llama.cpp server and motion-block registration alongside Ollama and LM
  Studio; shared escaping, bounded queues and SSE helpers.

### Changed

- HyperFrames is the sole preview/export/audiogram engine. Existing projects
  migrate safely; saved copy, media, original takes and historical exports remain.
  New renders may look different from legacy Remotion outputs.
- Exact compatible dependency upgrades, Node 24 LTS, Prisma 7 migration support,
  Windows/Linux CI, local fonts/GSAP and current screenshots/documentation.
- Editor voice/render operations use durable SQLite jobs with reconnect, explicit
  retry, cancellation, lease recovery and current revision checks.
- Measured provider word timing is retained; estimated captions remain labeled.
  Kokoro narration is chunked against the tokenizer and globally serialized.

### Security and reliability

- Loopback binding, raw Host validation, authenticated reads/media/progress,
  strict bearer enforcement, expression-free Lottie and safe key persistence.
- Bounded request/media IO, streaming checksums, DNS-pinned export staging,
  portable process-tree cancellation and framing protections.
- Reduced polling queries, verified SQLite WAL/busy handling, bounded progress
  writes and healthy-uptime supervisor recovery.
- Replaced the opaque phonemizer binary with a pinned source-built engine;
  corresponding source and component notices accompany the release.
- Component licenses remain distinct: MIT application, Apache HyperFrames,
  GPL eSpeak phonemizer, custom GSAP and optional model/media terms.

See [upgrade/release notes](docs/RELEASE_0.4.0.md),
[current evidence](docs/production/RELEASE_VALIDATION.md) and
[component licenses](docs/LICENSING.md).

## Historical 0.4 preparation — 2026-09-13

This was internal pre-release work, not a published GitHub v0.4.0 release.
The dual-engine descriptions below record that earlier implementation.

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

See [the upgrade notes](docs/archive/production/UPGRADES.md) and [release validation](docs/production/RELEASE_VALIDATION.md).

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
