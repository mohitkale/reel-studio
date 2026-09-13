# Reel Studio 0.4 implementation audit

- Audit date: 2026-09-13
- Reviewed branch: `feat/premium-production`
- Reviewed range: `3bd4582..f6e2fa6`

## Conclusion

The roadmap contains 28 numbered tasks, not 26. Tasks 3 and 4 intentionally
share one commit because the framework lockfile and Prisma migration were
treated as one compatibility change.

Of the 28 tasks:

- 21 meet their stated implementation target.
- 2 implement their interface and data behavior but inherit an operational
  worker-lifecycle limitation.
- 5 are partial against the complete written requirement.

The shipped application is a substantial local production release. It should
not yet claim that the web process supervises its worker, that cancellation
terminates an active encoder/browser, that every named video stage performs
independent work, or that every preset has been rendered against three distinct
briefs.

## Verification method

This audit compared the roadmap and acceptance text with the implementation,
schema migrations, API/MCP routes, production services, render adapters,
fixtures, commit history, and recorded release evidence. The current checkout
also passed:

- `npm run test:unit`: 42 files and 219 tests
- `npm run typecheck`
- `npm run lint`

The 36-output render matrix was not repeated during this documentation audit;
the audit checked its committed runner, fixtures, recorded media evidence, and
release notes.

## Task-by-task result

|   # | Result                               | Review                                                                                                                                                                                                                                                                                                                                               |
| --: | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Complete                             | Baseline behavior, dependency inventory, and regression fixtures are committed in `d241004`.                                                                                                                                                                                                                                                         |
|   2 | Complete                             | CI and credential-free dual-engine render harness are present in `ea60641`; later CI fixes install FFmpeg.                                                                                                                                                                                                                                           |
|   3 | Complete                             | Node 24, Next 16.3.4, React 19.2.8, matching types/configuration, Docker, and CI are synchronized. This shares `36a4ef1` with task 4.                                                                                                                                                                                                                |
|   4 | Complete                             | Prisma 7.10 uses versioned migrations, schema recognition, backup, fresh-install tests, and populated v0.3 upgrade coverage.                                                                                                                                                                                                                         |
|   5 | Complete for the frozen release      | HyperFrames producer 0.8.33 and CLI 0.8.27 passed legacy preview/render compatibility. New upstream versions require a new frozen audit.                                                                                                                                                                                                             |
|   6 | Complete                             | Remotion and every `@remotion/*` package are exactly 4.0.523; legacy templates, Three.js, Lottie, audio, and render paths are covered.                                                                                                                                                                                                               |
|   7 | Complete                             | Remaining direct packages were upgraded and compatibility exceptions recorded in `docs/production/UPGRADES.md`.                                                                                                                                                                                                                                      |
|   8 | Complete                             | The immutable Zod production specification, six versioned presets, capability metadata, snapshots, and legacy mapping are implemented.                                                                                                                                                                                                               |
|   9 | Complete for its acceptance target   | The importer keeps blocks and components separate, records provenance/checksums, pins a revision, and retains old versions. Product rendering still relies mainly on the separately maintained curated block manifest; the next phase should consolidate these catalog paths.                                                                        |
|  10 | Complete                             | Preview/export share resolved inputs, assets, timing, and native 9:16, 16:9, and 1:1 layout rules.                                                                                                                                                                                                                                                   |
|  11 | Complete                             | Charts require supplied structured values, unsafe personalization is escaped, and placeholders are rejected from production output.                                                                                                                                                                                                                  |
|  12 | Complete                             | Product Launch ships with the required roles and verified implementations in both engines.                                                                                                                                                                                                                                                           |
|  13 | Complete                             | Editorial Explainer ships with the required roles and verified implementations in both engines.                                                                                                                                                                                                                                                      |
|  14 | Complete                             | Creator Punch ships with the required roles and verified implementations in both engines.                                                                                                                                                                                                                                                            |
|  15 | Complete                             | Data Story preserves labels, values, units, and attribution in both engines and rejects missing data.                                                                                                                                                                                                                                                |
|  16 | Complete                             | Developer Demo ships code, diff, terminal, browser, and CTA roles in both engines with escaped technical content.                                                                                                                                                                                                                                    |
|  17 | Complete                             | Cinematic Brand ships hero, feature, testimonial, and logo roles in both engines with supplied-media validation.                                                                                                                                                                                                                                     |
|  18 | Partial                              | SQLite jobs, steps, events, outputs, idempotency, leases, heartbeats, recovery, and queued cancellation are real. The normal app/Docker launcher starts only Next.js; it does not supervise the standalone worker. Active render subprocesses do not receive the abort signal, so cancellation is cooperative only before/after the render boundary. |
|  19 | Partial                              | Durable video jobs invoke the existing renderer and verify the final MP4. The `plan`, `resolve_media`, `synthesize_audio`, `time_content`, and `prepare_composition` stages currently record success without performing stage-specific work, so this is not yet the complete pipeline described by the roadmap.                                      |
|  20 | Complete                             | The no-code wizard accepts text, bounded public URLs, and uploaded image/video/audio, and creates an editable deterministic project without AI.                                                                                                                                                                                                      |
|  21 | Complete                             | Scene/copy/asset locks, hook variants, and selective regeneration preserve unchanged content and reusable audio.                                                                                                                                                                                                                                     |
|  22 | Complete for the original task       | Caption tracks, timing provenance, editable cue text/timing, SRT/VTT import/export, optional whisper.cpp, and shared preview/export inputs are present. Detailed caption appearance controls are a new requirement.                                                                                                                                  |
|  23 | Partial                              | Shared voice/music/SFX envelopes, turn caching, selective regeneration, validation, and WAV/MP3 output are implemented. The broader written scope also required podcast intro/outro music, explicit editable pauses, and pronunciation substitutions; those controls and data contracts are absent.                                                  |
|  24 | Partial                              | Solo, two-host, and interview presets, deterministic chapters/transcripts, manual segment selection, and audiogram production are implemented. Optional AI clip suggestions grounded in transcript timestamps are absent.                                                                                                                            |
|  25 | Complete with operational caveat     | Shared REST/MCP schemas, scoped hashed tokens, provider/duration/batch/paid limits, approvals, compatibility adapters, and artifact retrieval are implemented. Unattended reliability still depends on manually running the standalone worker described under task 18.                                                                               |
|  26 | Complete with operational caveat     | Persistent batches, up to ten rows, three independently reflowed ratios, partial-failure retention, aggregate controls, and bundles are implemented. Queue processing inherits task 18's launcher limitation.                                                                                                                                        |
|  27 | Complete                             | Setup, local diagnostics, gallery assets, creator guidance, seeds, and a credential-free sample export are present.                                                                                                                                                                                                                                  |
|  28 | Partial against the full launch gate | Documentation, changelog, walkthroughs, dependency checks, 36 preset/engine/ratio renders, and release contracts are present. The 36 matrix uses one fixture per preset across both engines and three ratios; it does not demonstrate three materially different rendered briefs for every preset.                                                   |

## Cross-cutting findings

### Worker lifecycle and cancellation

`scripts/production-worker.ts` is a valid continuous worker, but `npm run dev`,
`npm run start`, and the Docker `app` service start only Next.js. Production
routes use Next.js `after()` callbacks to attempt local processing. Persistent
records make recovery possible, but reliable unattended production requires the
separate `npm run production:worker` process today.

The worker creates an abort signal when a heartbeat fails or cancellation is
requested. `executeVideoProductionJob` checks that signal before render, but the
HyperFrames, Remotion, and FFmpeg execution path does not accept it. A running
render therefore continues until its process returns.

### Video orchestration

The final render and artifact verification are genuine. Earlier named steps are
currently progress markers around an already-prepared script/render request.
The next implementation should move deterministic/AI planning, media resolution,
voice reuse/synthesis, caption timing, and composition preparation into explicit,
idempotent step handlers with saved outputs and invalidation keys.

### HyperFrames catalog

The release correctly stores a pinned 20-item catalog revision and separates
blocks from components. It also retains a legacy embedded catalog and handwritten
template unions used by planning/rendering. This makes the release reproducible,
but adding current upstream items requires several manual edits and imported
components are not automatically exposed as user-selectable capabilities.

### Podcast finishing and captions

Podcast generation has the expensive caching and export foundations. It still
needs intro/outro music assignments, explicit pause controls, pronunciation
substitutions, and timestamp-grounded optional clip suggestions.

Caption content and timing are editable and shared across engines. Appearance is
currently fixed by renderer CSS/React styles, while preset metadata only selects
a named caption style. User-editable caption typography and treatments belong in
the next versioned production specification.

### Current provider scope

Stock backgrounds are Unsplash image-only and automatically choose the first
result. Attribution is available on the transient provider result but is not
persisted as a complete reusable asset record. AI providers are Gemini and
OpenAI only. These are product boundaries rather than regressions in the 0.4
implementation.

## Required carry-over

The next phase should close tasks 18, 19, 23, 24, and the remaining task 28
acceptance evidence. Tasks 25 and 26 should be revalidated after the worker
lifecycle changes. The implementation plan is
[`docs/LOCAL_FIRST_EXPANSION.md`](../LOCAL_FIRST_EXPANSION.md).
