# Changelog

All notable changes to Reel Studio are documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

## 1.1.0 (2026-11-23)

- fix: MCP video failures name the production stage, cause and recovery step, including invalid storyboards and videos that exceed their duration limit (#114)
- fix: scenes that asked for a picture and did not get one are reported (a warning per scene from `create_video`, a finding from `review_video`), a `media-split` scene without a picture is drawn as a statement instead of an empty box, and `media-split` scenes now trigger the stock search; `docs/STORYBOARD.md` says which providers supply pictures (#245)
- fix: declare `sharp` as a direct dependency; visual review no longer relies on the voice package installing it (#234)
- fix: renders no longer fetch fonts from Google Fonts; families named only in custom properties (`Impact`, `Georgia`, `Times New Roman`) are mapped to the bundled ones, with a test that runs the compiler's font pass over every example and look (#233)

### Engine and rendering

- Add a Pro Tip scene with a bundled lightbulb badge ([#295](https://github.com/mohitkale/reel-studio/pull/295))
- Add five looping cloud illustrations ([#293](https://github.com/mohitkale/reel-studio/pull/293))
- Add the Retro Terminal storyboard theme ([#291](https://github.com/mohitkale/reel-studio/pull/291))
- Keep the scene scaffold usable after the first contribution ([#292](https://github.com/mohitkale/reel-studio/pull/292))
- Add the High Contrast storyboard theme ([#290](https://github.com/mohitkale/reel-studio/pull/290))
- Add the Forest storyboard theme ([#289](https://github.com/mohitkale/reel-studio/pull/289))
- Add the Sunset storyboard theme ([#288](https://github.com/mohitkale/reel-studio/pull/288))
- Add Pro position and scale controls for presenters ([#287](https://github.com/mohitkale/reel-studio/pull/287))
- Review finished videos and reuse sections on MCP edits ([#284](https://github.com/mohitkale/reel-studio/pull/284))
- feat: measure existing video export baselines (#262) ([#263](https://github.com/mohitkale/reel-studio/pull/263))
- fix: declare sharp as a direct dependency (#234) ([#255](https://github.com/mohitkale/reel-studio/pull/255))
- fix: renders no longer fetch fonts from Google Fonts (#233) ([#256](https://github.com/mohitkale/reel-studio/pull/256))

### Storyboard

- Add a sourced trail-map storyboard to the golden set ([#294](https://github.com/mohitkale/reel-studio/pull/294))
- fix: write publishing files for every video export (#132) ([#268](https://github.com/mohitkale/reel-studio/pull/268))

### MCP

- fix: report actionable MCP production failures (#114) ([#272](https://github.com/mohitkale/reel-studio/pull/272))

### Studio

- feat: preview and remix bundled video examples (#124) ([#278](https://github.com/mohitkale/reel-studio/pull/278))
- fix: preserve the finished result when making other sizes (#122) ([#277](https://github.com/mohitkale/reel-studio/pull/277))
- feat: show live previews and preserve step timing (#121) ([#271](https://github.com/mohitkale/reel-studio/pull/271))
- docs: record Simple and Pro capabilities (#143) ([#270](https://github.com/mohitkale/reel-studio/pull/270))
- fix: show real frames on project cards (#119) ([#269](https://github.com/mohitkale/reel-studio/pull/269))
- fix: use plain language across the Studio (#123) ([#264](https://github.com/mohitkale/reel-studio/pull/264))
- fix: report scenes whose picture did not resolve; media-split without a picture is a statement (#245) ([#257](https://github.com/mohitkale/reel-studio/pull/257))

### Audio and podcasts

- fix: embed podcast chapters and cover art in MP3 exports (#127) ([#279](https://github.com/mohitkale/reel-studio/pull/279))
- docs: evaluate Indian-language voice candidates (#237) ([#273](https://github.com/mohitkale/reel-studio/pull/273))
- fix: pick distinct music for cinematic and percussion themes (#129) ([#265](https://github.com/mohitkale/reel-studio/pull/265))

### CI and tooling

- test: share the Windows integration timeout (#260) ([#261](https://github.com/mohitkale/reel-studio/pull/261))
- fix: make two flaky tests specific and realistic about time (#249) ([#258](https://github.com/mohitkale/reel-studio/pull/258))

### Documentation

- docs: remove deferred Indic voice evaluation (#275) ([#276](https://github.com/mohitkale/reel-studio/pull/276))
- fix: regenerate the checked-in README screenshots (#135) ([#267](https://github.com/mohitkale/reel-studio/pull/267))

### Other changes

- docs: mark Reel Studio development as paused ([#296](https://github.com/mohitkale/reel-studio/pull/296))

## 1.0.0 (2026-11-20)

The storyboard format, the command line and the MCP tools are stable from here on: changes are
additive. **Known limits at this release** (details in `docs/RELEASE_READINESS.md`): the package is
not published to npm, so `npx reel-studio` does not work yet; the MCP client install guides have not
been run in each client; Windows is exercised in CI only; nobody has scored the output against the
quality rubric, and the maintainer's own review found the visuals, voice and sound not yet premium;
picture scenes fall back silently when no stock media resolves (#245).

### Security

- Updated Next.js to 16.4.6, which fixes two critical remote code execution advisories (image
  optimisation and `use cache`) and a denial of service in server actions, plus Zod, Prisma and
  the transitive Puppeteer and Hono packages. `npm audit` on production dependencies: 0 critical;
  the 3 remaining high advisories (`sharp` through `kokoro-js`) have no fix yet and are recorded
  with their reasoning in `docs/security-exceptions.json`. `npm run audit:check` enforces this.

### Changed

- Storyboard v1 is frozen: the schema may only grow, enforced by a compatibility test against the
  frozen schema and a corpus of the golden storyboards (`docs/STORYBOARD.md`).
- Added `npm run release:ready`, `test:upgrade-v080`, `licensing:check` and `audit:check`, and
  `docs/RELEASE_READINESS.md`; fixed `test:release-upgrade`, which had been failing since v0.8.0.
- `docs/LICENSING.md` now names every non-permissive dependency licence in the production tree.

### Upgrade notes

This release adds 1 database migration. Stop the app, back up the database and `media/` folder together, then run `npm run setup`. See [upgrading](docs/GETTING_STARTED.md#upgrading-and-rolling-back).

### Engine and rendering

- feat: theme:new and scene:preview, a 15-minute theme tutorial (L4, part) ([#214](https://github.com/mohitkale/reel-studio/pull/214))
- fix: real exports dropped every scene's panel data (steps, diagram, checklist, illustration) ([#193](https://github.com/mohitkale/reel-studio/pull/193))
- feat: sixty looping illustrations and a storyboard illustration field (V12b) ([#192](https://github.com/mohitkale/reel-studio/pull/192))
- feat: whisper.cpp word timing for final exports, pop captions scale in (V4b) ([#185](https://github.com/mohitkale/reel-studio/pull/185))
- feat: six recommended voices with a short sample each on /voices (V8b) ([#184](https://github.com/mohitkale/reel-studio/pull/184))
- feat: stage, scene and time-left estimate while a video renders (V9b); caption timing check script ([#183](https://github.com/mohitkale/reel-studio/pull/183))
- feat: three arrangements per scene type, Shuffle look, series look lock (V11b) ([#182](https://github.com/mohitkale/reel-studio/pull/182))
- perf: draft previews capture a half-size canvas, 3x faster (V9b) ([#181](https://github.com/mohitkale/reel-studio/pull/181))
- feat: layout contract: content region, caption band, fill-the-frame type (V2) ([#172](https://github.com/mohitkale/reel-studio/pull/172))
- feat: v0.11 slice 1: quality rubric and frame checks, first layout fixes (V1, part of V2) ([#170](https://github.com/mohitkale/reel-studio/pull/170))
- feat: v0.10 storyboard writer, research, golden set and project export (S5–S8) ([#168](https://github.com/mohitkale/reel-studio/pull/168))
- fix: fit on-screen copy instead of cutting it ([#167](https://github.com/mohitkale/reel-studio/pull/167))
- feat: produce a finished video from one storyboard call ([#166](https://github.com/mohitkale/reel-studio/pull/166))

### Storyboard

- feat: storyboard linter with auto-repair and POST /api/storyboards/lint ([#165](https://github.com/mohitkale/reel-studio/pull/165))
- feat: Storyboard v1 schema, generated JSON Schema and guide ([#164](https://github.com/mohitkale/reel-studio/pull/164))

### MCP

- feat: agent-visible results, review_video and revise_video (M5, M6) ([#197](https://github.com/mohitkale/reel-studio/pull/197))
- feat: doctor --fix downloads missing FFmpeg, Chrome and the voice model with consent (M8) ([#196](https://github.com/mohitkale/reel-studio/pull/196))
- docs: install guides for eight MCP clients, marked as not yet run in each client (M9) ([#198](https://github.com/mohitkale/reel-studio/pull/198))
- feat: self-starting MCP server with a per-install secret (M2) ([#195](https://github.com/mohitkale/reel-studio/pull/195))
- feat: storyboard resources, five prompts and server instructions for agents (M4) ([#188](https://github.com/mohitkale/reel-studio/pull/188))
- feat: five core MCP tools and REEL_STUDIO_MCP_TOOLS=core (M3, first part) ([#187](https://github.com/mohitkale/reel-studio/pull/187))
- feat: headless command line: render, lint, schema, examples with exit codes (M7) ([#186](https://github.com/mohitkale/reel-studio/pull/186))

### Studio

- fix: quieter default sound, pictures that fill the frame, real README screenshots (#246) ([#247](https://github.com/mohitkale/reel-studio/pull/247))
- feat: v0.14 audio and podcast factory: podcast, narration, music, chapters, shorts, publishing kit, series and batch (A1 to A7) ([#221](https://github.com/mohitkale/reel-studio/pull/221))
- feat: v0.13 leftovers: steps that run by themselves, tell me what to change, step times, previous version (U9, U4, U3) ([#220](https://github.com/mohitkale/reel-studio/pull/220))
- feat: v0.13 part 2: Playwright journeys and accessibility, core MCP tools by default, another voice (U8, M3, U4 part) ([#218](https://github.com/mohitkale/reel-studio/pull/218))
- feat: v0.13 no-code Studio part 1: Simple and Pro modes, navigation, setup, result page edits (U9, U5, U2, U4 part) ([#216](https://github.com/mohitkale/reel-studio/pull/216))
- feat: Examples page: start from a golden storyboard, change the text, no AI needed (U6) ([#200](https://github.com/mohitkale/reel-studio/pull/200))
- feat: no-API-key mode: copy a prompt, paste the reply, checked and produced (U7) ([#203](https://github.com/mohitkale/reel-studio/pull/203))
- feat: plain steps list on the result page while a video is made (U3, first part) ([#202](https://github.com/mohitkale/reel-studio/pull/202))
- feat: one-prompt home screen: one box, format, length and look, one Create button (U1) ([#199](https://github.com/mohitkale/reel-studio/pull/199))

### Audio and podcasts

- feat: whisper DTW word timing and an independent timing check (V4b) ([#194](https://github.com/mohitkale/reel-studio/pull/194))
- fix: voice:download and setup --voice ran into top-level await; record the fresh-clone check (V8b) ([#189](https://github.com/mohitkale/reel-studio/pull/189))

### CI and tooling

- ci: one-command releases with a tag-triggered publish workflow ([#163](https://github.com/mohitkale/reel-studio/pull/163))
- ci: fast PR gate and on-demand full matrix ([#156](https://github.com/mohitkale/reel-studio/pull/156))
- test: split fast unit tests from integration tests ([#154](https://github.com/mohitkale/reel-studio/pull/154))

### Documentation

- docs: interim README, one-screen pitch ([#162](https://github.com/mohitkale/reel-studio/pull/162))
- docs: consolidate guides into a small canonical set, add link check ([#159](https://github.com/mohitkale/reel-studio/pull/159))
- docs: feature inventory and parity guard ([#158](https://github.com/mohitkale/reel-studio/pull/158))
- docs: single agent rule file, pointers for other harnesses ([#157](https://github.com/mohitkale/reel-studio/pull/157))

### Repository

- chore: MIT-only LICENSE, move third-party notice to NOTICE.md ([#160](https://github.com/mohitkale/reel-studio/pull/160))
- chore: roadmap task form, PR template and label guide ([#155](https://github.com/mohitkale/reel-studio/pull/155))
- chore: trunk-based branching strategy and repo cleanup ([#153](https://github.com/mohitkale/reel-studio/pull/153))

### Other changes

- feat: niche showcase of thirty sourced videos, share text, optional end tag (L8) ([#236](https://github.com/mohitkale/reel-studio/pull/236))
- feat: release readiness: frozen Storyboard v1, v0.8.0 upgrade test, licence and audit gates, security updates (L6) ([#235](https://github.com/mohitkale/reel-studio/pull/235))
- docs: launch plan with positioning, claims guard rail, channel drafts and a launch video made by Reel Studio (L5) ([#232](https://github.com/mohitkale/reel-studio/pull/232))
- feat: npm run scene:new scaffolds a scene type, scenes bring their own styles, and a 15-minute tutorial (L4) ([#231](https://github.com/mohitkale/reel-studio/pull/231))
- fix: the website serves its posters itself, so the first screen does not wait on a release redirect (L3) ([#227](https://github.com/mohitkale/reel-studio/pull/227))
- feat: project website with gallery, MCP page and rendered docs (L3) ([#226](https://github.com/mohitkale/reel-studio/pull/226))
- feat: launch README and a demo asset pipeline (L1, L2) ([#225](https://github.com/mohitkale/reel-studio/pull/225))
- feat: shorts as one batch, editor presenter preview, lip-sync check, brand-kit stings, scenes on the beat (A3, A5, P1) ([#224](https://github.com/mohitkale/reel-studio/pull/224))
- feat: v0.14 and v0.15 leftovers: pace, output folder, stings, series defaults, presenter, recap and resumable sections (A2 to A7, P1) ([#223](https://github.com/mohitkale/reel-studio/pull/223))
- feat: v0.15 local AI studio: local writer, voice range, image generation, recordings to clips, animated presenter (P1 to P5) ([#222](https://github.com/mohitkale/reel-studio/pull/222))
- chore: stop tracking a Playwright result file that was committed by mistake ([#219](https://github.com/mohitkale/reel-studio/pull/219))
- fix: npm run dev and npm start crashed on a missing import in supervise.mjs ([#217](https://github.com/mohitkale/reel-studio/pull/217))
- feat: v0.11 wave C: variety engine, camera moves, showcase command, gating frame check (V11, V12, V10) ([#175](https://github.com/mohitkale/reel-studio/pull/175))
- feat: v0.11 wave B: captions, sound, voice download, render benchmark (V4, V7, V8, V9) ([#174](https://github.com/mohitkale/reel-studio/pull/174))
- feat: v0.11 wave A: twenty scene types, ten themes, bundled icons (V3, V5, V6) ([#173](https://github.com/mohitkale/reel-studio/pull/173))

## 0.8.0

### Added

- OpenAI Responses web research with bounded hosted search, shared frozen evidence
  for Ollama/LM Studio/llama.cpp writers, and separate researcher/writer readiness
  in Settings. Sources-only local writing requires no cloud key or search call.
- Authenticated research APIs with versioned evidence/source contracts, immutable
  revisions, six-hour caching, durable idempotency, cancellation and deadlines.
- Optional Gemini Search/URL grounding with preserved citations and attribution,
  explicit researcher models, separate call/search allowances and offline fixtures.
- Supplied-text/public-article evidence capture with no cloud calls, hardened URL
  fetching, bounded responses and redacted errors.
- Saved research evidence in creation/remix/results, linked excerpts and numeric
  admission checks shared by REST and MCP.
- Source-linked editorial writing before local storyboard compilation, creative
  briefs, durable call budgets and guarded scene-specific copy/visual revisions.
- Subject/crop/resolution/continuity ranking for automatic media, saved reasons
  and alternatives, plus separately budgeted optional vision scoring.
- Supplied screenshot/recording proof mapped to features and recurring subjects,
  contained device frames, checked recording cues and copy-preserving replacement.
- Five-brief offline editorial/MCP benchmark, active-app verified exports and
  checksummed human review records; live writers remain explicitly opt-in.

### Fixed

- Markdown cleanup preserves paired technical identifiers such as `input_image`
  and `image_url`, including repeated internal underscores.
- Cinematic Brand closings without a supplied visual no longer insert a default
  `RS` mark; closing copy remains visible.

### Upgrade

- Two additive research/media-ranking migrations since v0.7.0, with unchanged
  dependency pins. Stop the app, retain a paired database/media backup and use the
  backup-aware setup runner. See [upgrade and rollback](docs/archive/releases/RELEASE_0.8.0.md).

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

- Linux CI prefers Ubuntu's HTTPS package archive with mirror fallback and
  bounded download retries after the runner's Azure mirror stalled. All platform
  checks, tests, builds and deadlines remain required.
- Asset deletion protects current content, frozen revisions/jobs/profiles,
  finishing snapshots and saved history. Edited video takes preserve intentional
  omissions; their timeline labels explain omitted scenes.
- Microphone permission waits are explicit and cancelable; canceled or unmounted
  requests release late streams. Audio plan revision conflicts retain saved work.

### Upgrade

- Three additive studio migrations since v0.6.0. Existing databases use the
  backup-aware `npm run db:migrate`; dependency pins are unchanged. Local Whisper
  remains optional and needs an explicitly supplied/downloaded model.
  See [upgrade and rollback](docs/archive/releases/RELEASE_0.7.0.md).

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
  See [upgrade and rollback](docs/archive/releases/RELEASE_0.6.0.md).

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

See [upgrade/release notes](docs/archive/releases/RELEASE_0.4.0.md),
[current evidence](docs/archive/release-evidence/RELEASE_VALIDATION.md) and
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

See [the upgrade notes](docs/archive/production/UPGRADES.md) and [release validation](docs/archive/release-evidence/RELEASE_VALIDATION.md).

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
