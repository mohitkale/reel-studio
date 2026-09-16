# 0.4 release validation

This document records the launch gate for the complete local content-production
release. It separates fast contract coverage from real media rendering so normal
pull requests remain practical.

Final gate result: **passed on September 13, 2026**. The clean install, 220
tests, typecheck, zero-warning lint, secret scan, Next.js production build, fast
release contract, empty-font-cache HyperFrames render, and 36-output media matrix
all completed successfully.

## Local-first expansion Gate 5

PR 8 extends this release gate with Quick Produce. Its required contract adds an
off-by-default UI, immutable submitted revisions, persisted eight-stage
progress, conflict-safe editable recovery, shared REST/MCP/batch schemas, and
the existing scoped provider limits. Live cloud and local-model tests remain
conditional: they run only when the provider is configured and the operator has
authorized usage. Deterministic planner, offline/malformed provider, stock
fallback, strict schema, and paid-retry behavior are always covered by fixtures.

The Gate 5 rerun on September 16, 2026 uses the commands below plus
`npm run test:production-worker` and `npm run test:render`. A credential-free
isolated sample export supplies the real H.264/AAC proof without requiring a
Kokoro model download. Exact results and artifact paths are recorded in
[`LOCAL_FIRST_PR8_TASKS.md`](LOCAL_FIRST_PR8_TASKS.md).

Gate 5 result: **passed on September 16, 2026**. Typecheck, zero-warning lint,
386 unit tests, secret scan, production build, release contract, fresh/populated
migration coverage, real dual-engine worker/cancellation, legacy dual-engine
render, isolated 14.9-second 1080×1920 H.264/AAC sample, browser revision flow,
and all 36 fresh release renders passed. The matrix completed in 2,151.7 seconds.
Ollama and LM Studio were not running, so their live smokes were correctly
skipped while their deterministic fixtures passed.

## Reproduce the gate

Use Node 24 LTS, npm 11, FFmpeg/FFprobe, and a Chromium-capable host.

```bash
npm ci
npm run release:check
npm run typecheck
npm run lint
npm test
npm run security:scan
npm run build
npm run release:matrix
```

`release:check` verifies exact dependency pins, synchronized Remotion packages,
the migration chain, release documentation, all preset/engine/role capability
mappings, three materially different deterministic briefs per preset, 18
offline HyperFrames composition variants, and decodable bundled gallery media.

`release:matrix` performs 36 real H.264 renders: six presets, both engines, and
three distinct briefs per preset, distributed across portrait, landscape, and
square canvases. It checks dimensions and decodability, writes MP4s under
`.artifacts/render-regression/`, and records the selected brief and its SHA-256
hash with hardware, elapsed time, duration, and file size in
`.artifacts/release-matrix/report.json`. The original 0.4 report remains in
[`RELEASE_MATRIX_0.4.0.json`](RELEASE_MATRIX_0.4.0.json); the corrected
three-brief evidence is preserved in
[`LOCAL_FIRST_PR2_RENDER_MATRIX.json`](LOCAL_FIRST_PR2_RENDER_MATRIX.json).

## Acceptance matrix

| Requirement                               | Evidence                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh install and recognized v0.3 upgrade | Eleven versioned migrations; setup and migration tests exercise fresh, populated, backup, recognition, and restore behavior                              |
| Existing projects and engine selection    | Legacy mapping, repository, editor, preview, and real dual-engine fixture regressions                                                                    |
| Six presets in both engines               | Role capability contracts, three briefs per preset, and the 36-output render matrix                                                                      |
| Three native canvas formats               | Shared safe-area tests plus portrait, landscape, and square outputs from each engine                                                                     |
| No-key first production                   | Bundled gallery, `npm run sample:export`, deterministic planning, uploaded assets, and placeholder audio                                                 |
| Complete durable production               | Job stage, lease expiry, restart, idempotency, cancellation, concurrency, cache, and artifact verification tests                                         |
| Voice, captions, and podcast editing      | Provider fixtures, SRT/VTT cases, optional local transcription diagnostics, turn caching, selective regeneration, WAV/MP3, transcript, and chapter tests |
| Podcast audiogram                         | Real podcast-to-video H.264/AAC render that retains the completed take audio                                                                             |
| Scoped unattended MCP                     | Shared REST/MCP contract tests, legacy approval flow, automatic-render scope, provider limits, duration/batch quotas, and artifact downloads             |
| Partial batch failure                     | Independently durable children retain successful outputs and bundle a failure manifest across retry                                                      |
| Quick Produce revision safety             | Toggle default, stable snapshot hashing, duplicate idempotency, current/submitted conflict reporting, restore-as-new, and produce-current contract tests |
| Quick Produce recovery                    | Eight persisted stages, cache reuse, restart/lease recovery, cancellation, explicit paid retry, and real dual-engine worker regression                   |
| Shared REST/MCP/batch options             | One strict Quick Produce/media schema, scoped provider/automatic/duration/batch policy, per-variant revisions, and partial-failure preservation          |
| Optional local AI                         | Ollama and LM Studio discovery, strict structured plans, repair exhaustion, offline server, and model guidance fixtures; live smoke only when configured |
| Offline frame assets                      | Render workspaces copy GSAP and WOFF2 assets locally; generated producer HTML contains no Google Fonts or runtime CDN reference                          |
| Input and authorization safety            | Public URL network-boundary tests, strict Zod schemas, HTML escaping, legacy-route quota checks, and secret scan                                         |
| Browser usability                         | Wizard, editor/captions, podcast, render recovery/download, gallery, diagnostics, keyboard, and console smoke reviews                                    |

## Release environment and performance

The final measured environment and complete matrix duration come from the
generated report. These measurements describe this machine and are not product
speed promises.

- Platform: macOS x64
- CPU and memory: Intel Core i7-9750H at 2.60 GHz, 12 logical CPUs, 16 GiB RAM
- Node: 24.18.1
- Workload: 36 credential-free fixture renders, with engine setup repeated for
  each preset/canvas combination
- Total elapsed time: 1,911.4 seconds (31 minutes 51.4 seconds), including the
  clean-install Remotion browser download
- Output size: 59,591,190 bytes across 36 MP4s
- Preset/canvas pair time: 56.8 to 163.9 seconds for both engines on this host

Initial dependency and browser installation is a cold setup cost. The matrix
does not claim hosted or instant rendering, and its repeated bundling is more
conservative than a warm interactive session.

## Package and provider limits

All compatible direct dependencies use frozen exact stable versions. Known
upstream exceptions and unresolved transitive advisories are documented in
[UPGRADES.md](UPGRADES.md); checks are not weakened to hide them. Optional live
cloud-provider smoke tests run only when credentials and an explicit usage
allowance are present. An uncertain paid request is not retried automatically.

Launch validation covers short-form videos up to three minutes and podcasts up
to ten minutes. Arbitrary prompts may still require custom design or supplied
media; the release promises repeatable production from the supported presets and
inputs described in [the walkthroughs](../WALKTHROUGHS.md).
