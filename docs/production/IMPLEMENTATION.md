# Premium production implementation

Branch: `codex/premium-production`. Base: `3bd4582` (v0.3.0).
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
- [x] 11. Chart correctness and safe personalization. Depends on 10. Evidence: structured chart data survives editor/API/repository/spec/engine boundaries; data and metric scenes require explicit values; catalog placeholders are excluded from production output; user-controlled HTML/script substitutions are escaped; focused correctness and injection regressions plus the milestone build/render gate pass. SHA: this commit.
- [x] 12. Product Launch preset. Depends on 11. Evidence: versioned hook, screenshot demo, feature, comparison and CTA roles resolve through compatible templates; responsive native renderers ship for HyperFrames and Remotion; missing screenshot media is rejected; a bundled dashboard sample renders to verified 10-second H.264 MP4s in both engines with role-boundary stills. SHA: this commit.
- [x] 13. Editorial Explainer preset. Depends on 12. Evidence: versioned headline, explanation, diagram, quote and summary roles resolve through compatible templates; responsive paper-inspired native renderers ship for HyperFrames and Remotion; dynamic Remotion metadata preserves the complete 12-second scene sequence; verified H.264 samples and contact sheets cover both engines. SHA: this commit.
- [x] 14. Creator Punch preset. Depends on 13. Evidence: versioned hook, tip, emphasis, payoff and CTA roles resolve through compatible templates; both native renderers use beat-oriented entrances, creator typography, selective visual accents and responsive tip layouts; a credential-free 10-second portrait fixture renders to verified H.264 output in both engines. SHA: this commit.
- [ ] 15. Data Story preset. Depends on 14. Evidence/SHA: pending.
- [ ] 16. Developer Demo preset. Depends on 15. Evidence/SHA: pending.
- [ ] 17. Cinematic Brand preset. Depends on 16. Evidence/SHA: pending.
- [ ] 18. Persistent production worker. Depends on 17. Evidence/SHA: pending.
- [ ] 19. Complete video orchestration. Depends on 18. Evidence/SHA: pending.
- [ ] 20. Creation wizard and deterministic/source planning. Depends on 19. Evidence/SHA: pending.
- [ ] 21. AI planning and selective regeneration. Depends on 20. Evidence/SHA: pending.
- [ ] 22. Editable captions and local transcription. Depends on 21. Evidence/SHA: pending.
- [ ] 23. Audio mixing and podcast caching. Depends on 22. Evidence/SHA: pending.
- [ ] 24. Podcast presets, chapters and audiograms. Depends on 23. Evidence/SHA: pending.
- [ ] 25. Scoped MCP automation. Depends on 24. Evidence/SHA: pending.
- [ ] 26. Batch jobs and format variants. Depends on 25. Evidence/SHA: pending.
- [ ] 27. Setup, diagnostics and gallery. Depends on 26. Evidence/SHA: pending.
- [ ] 28. Release validation and documentation. Depends on 27. Evidence/SHA: pending.

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
