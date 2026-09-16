# Premium production implementation

Branch: `feat/premium-production` (renamed without rewriting commits). Base:
`3bd4582` (v0.3.0).
Commit actual completion dates. Preserve existing projects, media, engine IDs and API behavior.

## Release contract

Local-first; six presets on both engines; deterministic and optional AI creation; durable production; voice/podcast/captions; opt-in unattended MCP; three ratios and batches of up to ten inputs. No hosted accounts, paid generative media, social publishing, or arbitrary executable AI compositions.

## Execution

Work in the numbered order. For each task, record acceptance evidence and commit SHA below. Gates after 7, 11, 17, 24 and 28 must pass before proceeding. Run typecheck, relevant tests, lint and secret scan; build and render matrix at gates. Never weaken checks to accept an upgrade.

- [x] 01. Baseline, frozen package inventory, regression fixtures. Evidence: `d241004`.
- [x] 02. CI and both-engine render harness. Evidence: `ea60641`; both engines encoded baseline MP4s and exposed a HyperFrames visibility regression.
- [x] 03. Node, Next, React and framework upgrade. Evidence: Next 16.3.4 production build, typecheck, lint and unit tests pass; commit recorded with task 04 because the lockfile and Prisma adapter migration are atomic.
- [x] 04. Prisma upgrade and safe migration baseline. Evidence: Prisma 7.10 migration, fresh/legacy database tests, populated demo seed, backup and drift rejection; `36a4ef1`.
- [x] 05. HyperFrames runtime compatibility. Depends on 4. Evidence: producer 0.8.33 and CLI 0.8.27; clean CLI contract/layout/contrast validation; locally bundled GSAP; real dual-engine MP4 regression with visible foreground and a seekable root timeline. SHA: `5c0aa88`.
- [x] 06. Remotion synchronized upgrade. Depends on 5. Evidence: all Remotion packages at 4.0.523 and Zod 4.5.4; `remotion versions`, typecheck, lint and 105 unit tests pass; real H.264 render exercises Three.js and Lottie; still matrix covers all seven legacy templates. SHA: `79de198`.
- [x] 07. Remaining packages and first compatibility gate. Depends on 6. Evidence: exact direct pins; clean `npm ci`; valid peer tree; zero-warning lint; typecheck; 106 tests; Next production build; real dual-engine renders and seven-template still matrix; secret scan. Compatibility and advisory exceptions are recorded in `UPGRADES.md`. SHA: `3650ddd`.
- [x] 08. Versioned production contracts. Depends on 7. Evidence: immutable Zod production snapshot, six versioned preset definitions, both-engine template capability metadata, legacy project mapping and focused invariant tests. SHA: `329bad0`.
- [x] 09. Catalog provenance and version retention. Depends on 8. Evidence: 20 curated items imported from pinned upstream revision `c93c7654033282e1a66a662a39fb10b8ed273b7d`; blocks/components separated; declared assets, attribution, dependencies, layouts and SHA-256 checksums recorded; legacy catalog retained; repeat import and checksum tests pass. SHA: `3e90a8e`.
- [x] 10. Shared layout and media inputs. Depends on 9. Evidence: one resolved composition input maps immutable assets, timing and styling for preview/export; portrait, landscape and square rules drive safe areas and engine chrome; both-engine ratio matrix passes. SHA: `45323f8`.
- [x] 11. Chart correctness and safe personalization. Depends on 10. Evidence: structured chart data survives editor/API/repository/spec/engine boundaries; data and metric scenes require explicit values; catalog placeholders are excluded from production output; user-controlled HTML/script substitutions are escaped; focused correctness and injection regressions plus the milestone build/render gate pass. SHA: `2bcd94b`.
- [x] 12. Product Launch preset. Depends on 11. Evidence: versioned hook, screenshot demo, feature, comparison and CTA roles resolve through compatible templates; responsive native renderers ship for HyperFrames and Remotion; missing screenshot media is rejected; a bundled dashboard sample renders to verified 10-second H.264 MP4s in both engines with role-boundary stills. SHA: `293d3ea`.
- [x] 13. Editorial Explainer preset. Depends on 12. Evidence: versioned headline, explanation, diagram, quote and summary roles resolve through compatible templates; responsive paper-inspired native renderers ship for HyperFrames and Remotion; dynamic Remotion metadata preserves the complete 12-second scene sequence; verified H.264 samples and contact sheets cover both engines. SHA: `ae7de11`.
- [x] 14. Creator Punch preset. Depends on 13. Evidence: versioned hook, tip, emphasis, payoff and CTA roles resolve through compatible templates; both native renderers use beat-oriented entrances, creator typography, selective visual accents and responsive tip layouts; a credential-free 10-second portrait fixture renders to verified H.264 output in both engines. SHA: `602e2a6`.
- [x] 15. Data Story preset. Depends on 14. Evidence: metric, chart, comparison and takeaway roles resolve through compatible templates; structured labels, values, units and attribution render without inference in both engines; Data Story specs reject missing metric values and missing chart data; proportional bars use seek-safe motion and a 10.5-second fixture verifies both H.264 outputs. SHA: `d6f8c70`.
- [x] 16. Developer Demo preset. Depends on 15. Evidence: code, diff, terminal, browser and CTA roles resolve through compatible templates; both renderers escape code and provide technical, responsive panels; browser proof requires supplied image/video media; a bundled dashboard fixture renders a verified 12-second H.264 sequence in both engines. SHA: `62dbd9d`.
- [x] 17. Cinematic Brand preset and preset milestone gate. Depends on 16. Evidence: hero, feature, testimonial and logo roles resolve through compatible templates; supplied image media, measured movement, serif typography, testimonial attribution and restrained logo close render in both engines; the schema requires hero media; a bundled 12-second fixture and the complete six-preset milestone matrix pass. SHA: `da0d176`.
- [x] 18. Persistent production worker. Depends on 17. Evidence: SQLite-backed jobs, steps, ordered events and outputs; immutable JSON input snapshots and unique idempotency keys; atomic bounded claims, leases, heartbeats, expired-lease recovery, cooperative active cancellation and immediate queued cancellation; one-run worker primitive ready for supervised launch. SHA: `1c9a20d`.
- [x] 19. Complete video orchestration. Depends on 18. Evidence: durable video jobs execute the ordered eight-stage pipeline through the existing engine-aware renderer; each stage persists progress; leases are checked before expensive work; final MP4 verification checks size, decoding, dimensions, duration and expected audio before recording a checksummed output; compatibility render routes remain unchanged. SHA: `a758050`.
- [x] 20. Creation wizard and deterministic/source planning. Depends on 19. Evidence: a four-step no-AI wizard accepts text, public URLs and uploaded image/video/audio; deterministic planning preserves full narration, resolves compatible preset roles and stores preset/brand/voice/source snapshots; URL imports enforce public DNS, redirect and size checks; preview/export consume saved roles and preset identity. SHA: `7261dff`.
- [x] 21. AI planning and selective regeneration. Depends on 20. Evidence: AI creation and append flows use versioned preset capability maps; users can select scenes, lock copy/assets/whole scenes and compare three source-grounded hook options before applying one; selective updates preserve scene IDs, uploaded asset references and reusable voice clips, while changed clips are detected as stale by the existing assembly contract; ID-aware undo restores the exact prior scene state. Focused database/prompt/preset tests and the complete 182-test suite pass. SHA: `16c6de9`.
- [x] 22. Editable captions and local transcription. Depends on 21. Evidence: versioned caption tracks and cues persist through a safe populated-database migration; users can generate, import, select, enable, edit and export SRT/VTT tracks with visible timing provenance; spoken copy remains separate from scene headlines; optional shell-free whisper.cpp transcription reports actionable local setup; preview and export share caption inputs; 190 tests, production build, browser editing QA and real HyperFrames/Remotion H.264 renders pass. SHA: `84b173f`.
- [x] 23. Audio mixing and podcast caching. Depends on 22. Evidence: a shared fade/duck/SFX envelope drives both engines; normalized speech masters fail on empty, silent or clipped output; podcast turns use exact text/provider/voice/model cache keys and selected turns can be forced while all other turns are reused; new and legacy takes provide WAV and cached 192 kbps MP3 outputs. The populated migration, 196-test suite, production build, browser workflow, real Kokoro selective-regeneration smoke and real dual-engine H.264 renders pass. SHA: `68de90d`.
- [x] 24. Podcast presets, chapters and audiograms. Depends on 23. Evidence: new podcasts start as solo narration, two-host discussion, or interview with compatible cast, AI direction, pacing and visual theme; generated and legacy takes expose deterministic turn-boundary chapters plus timestamped transcript/chapter downloads; users select a contiguous excerpt and ratio for a durable, verified Remotion audiogram that preserves the take's exact WAV samples. The populated migration, 203-test suite, lint, typecheck, production build, security scan, browser workflow, real Kokoro generation, 11.75-second portrait H.264/AAC podcast-to-video render and real dual-engine H.264 regression pass. SHA: `98af226`.
- [x] 25. Scoped MCP automation. Depends on 24. Evidence: named tokens retain only SHA-256 hashes and define explicit scopes, provider allowlists, duration and batch caps, automatic-render permission and finite paid-request budgets; one shared service and schema expose video, audio, podcast and audiogram jobs through REST and MCP while preserving legacy-token approvals and existing tools; durable status, events, approval, retry, cancellation and verified artifact downloads are available without secret or deletion access. Existing paid routes enforce the same provider policy. The 210-test suite, lint, typecheck, production build, security scan and browser review pass; isolated API smoke tests cover manual no-key audio, approval gating and paid-provider denial, while a restarted automatic job produces and downloads a verified 7.2-second HyperFrames H.264 artifact. SHA: `55eefaa`.
- [x] 26. Batch jobs and format variants. Depends on 25. Evidence: persistent batches group up to ten validated rows and retain one independently recoverable child job per output; video and audiogram rows default to source-resolved portrait, landscape and square variants rather than cropping a finished render; aggregate approval, cancel, retry and progress keep successful outputs when another item fails. REST, MCP and the Renders page expose the same batch state, while authenticated streamed tar.gz bundles contain completed artifacts and a failure manifest. A fresh six-migration database, populated job migration, 215 unit tests, the real render smoke, lint, typecheck, production build and security scan pass. Isolated API/browser smoke verifies a three-ratio approval batch and a partial audio failure whose successful WAV remains unchanged across retry and downloads in a valid bundle. SHA: `209e189`.
- [x] 27. Setup, diagnostics and gallery. Depends on 26. Evidence: idempotent setup installs bundled gallery media and finishes with required/optional runtime diagnostics; the app exposes the same checks, a three-format output gallery, six direct preset entry points and a creator guide; a single command produces a verified credential-free HyperFrames sample. A fresh six-migration database and setup rerun pass; diagnostics report seven required passes and one optional transcription warning; 218 tests, lint, typecheck, production build and security scan pass. Browser review confirms local media playback, preset handoff and a clean console, while the sample command produces a verified 14.9-second 1080×1920 H.264/AAC MP4. SHA: `55926a3`.
- [x] 28. Release validation and documentation. Depends on 27. Evidence: 0.4 package and migration notes; three reproducible walkthroughs; fast release contracts cover six presets, both engines, three formats and three briefs; HyperFrames renders from an empty font cache using locally bundled fonts; all 36 preset/engine/canvas H.264 outputs pass in a measured 1,911.4-second matrix; clean `npm ci`, 220 tests, lint, typecheck, Next production build and security scan pass. SHA: `0e6e998`.

## Baseline

- Clean checkout on main before branch creation.
- Node 24.18.1; npm 11.16.0.
- Typecheck and secret scan passed in initial review.
- 99 non-render tests passed; render smoke deliberately excluded from this initial fast pass.
- Lint: five existing errors (effect state updates in three UI components, one JSX apostrophe, one require import) and four warnings. Resolve before gate 7.
- Gate 1: all baseline lint errors and warnings are resolved; the complete clean-install validation matrix passes.
- Full package inventory: `dependencies.json`; targets freeze when audit completes.

## Acceptance matrix

Fresh install and populated v0.3 database upgrade; both engines and legacy templates; six presets × three ratios × three briefs; no-key demo; voice and scene-clip workflows; podcast partial regeneration; captions provenance; restart/idempotency/cancellation; MCP old approvals and opted-in unattended execution; batch partial failure; real decodable audio/video artifacts; local/offline media; safe URL ingestion.

Do not mark the release complete until these checks have evidence.

## Local-first expansion — PR 8

The numbered 0.4 plan above remains the historical release record. The later
local-first expansion has its own task numbering and ledgers. PR 8 implements
expansion Tasks 26–29 on `feat/quick-produce`; its detailed evidence is in
[`LOCAL_FIRST_PR8_TASKS.md`](LOCAL_FIRST_PR8_TASKS.md).

- [x] Expansion 26. Off-by-default Quick Produce creates an editable project,
      immutable `ProductionRevision`, and reconnectable durable video job. Revision
      hashes expose conflicts without overwriting newer edits. SHA: `be1339b`.
- [x] Expansion 27. The real eight-stage worker consumes the submitted snapshot,
      synthesizes or reuses server audio, preserves media/timing/composition/render
      caches, and requires explicit retry after uncertain paid voice work. SHA:
      `2c92001`.
- [x] Expansion 28. UI, REST, MCP, and video batches share Quick Produce/media
      validators, provider and duration policy, idempotency, item-scoped
      retry/cancel, revision reporting, and partial-failure semantics. SHA:
      `13f8fa4`.
- [ ] Expansion 29. Release documentation, setup, Settings, licensing,
      walkthroughs, architecture diagrams, and Gate 5 validation. Record the
      completion SHA and measured gate evidence in the PR 8 ledger after the final
      checks pass.
