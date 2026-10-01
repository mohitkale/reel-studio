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

## Motion graphics and bounded chapter production

The September 30, 2026 continuation adds a controlled five-minute allowance for
valid saved chapter videos at 24/30/60 fps. Other video storyboards and standalone
audio retain the three-minute policy; named MCP token allowances and old queued
job limits remain unchanged. Actual prepared timing, including covers, is checked
against the frozen allowance before rendering.
The migration chain now contains twelve migrations, including additive caption
take/frame-rate provenance; the fast release contract checks that exact count.

Reproduce the native section gates with the installed render dependencies:

```bash
npm run test:video-sections -- --cancel
npm run test:video-sections -- --long --speech --cancel
npm run test:video-sections -- --engine=remotion --edit
```

The default fixture uses 32 seconds, portrait, 30 fps and two chapters. `--long`
uses 210 seconds, landscape, 24 fps and six chapters. `--speech` requires the
already-installed macOS `say` voice and performs no download or provider call;
omit it elsewhere for a labeled calibration narration signal. `--engine` narrows
the gate to one engine. `--seed=<UUID>` repeats media identity for diagnostics;
the owned media directory must not already exist, preventing concurrent runs
from sharing it. Tests use an isolated migrated SQLite database and local assets.

Assertions cover exact video packet counts, continuous narration/music through
joins, verified encoded loudness/peak targets, cancellation cleanup, committed
section reuse, unchanged video packets and decoded audio across retry. Each
successful run saves MP4s, audio measurements, native chapter sheets, eight-frame
cut strips and `result.json` in `.artifacts/video-sections-<timestamp>/`.
`--edit` additionally compares full/scoped native Remotion stills, then requires
unchanged sections to reuse while the changed final visual renders again.

Measured local results (draft quality, separate runs):

| Fixture                              | Engine      | Verified frames | Export / unchanged retry                 | Sampled process-tree RSS |
| ------------------------------------ | ----------- | --------------- | ---------------------------------------- | ------------------------ |
| 210 s installed local speech         | Remotion    | 5,040           | 121.5 s / 112.0 s, cached video sections | 1.12 / 0.93 GiB          |
| 210 s installed local speech         | HyperFrames | 5,040           | 108.5 s / 122.1 s, cached video sections | 0.93 / 0.99 GiB          |
| 32 s calibration, scoped visual edit | Remotion    | 960             | 54.9 s cold / 21.3 s retry / 36.5 s edit | 1.88 / 0.95 / 1.71 GiB   |

The 210-second retries had identical encoded audio and zero decoded RMS error;
both delivered exactly 210 seconds. A separate cold cancellation/resume gate
retained the first completed section in each engine. HyperFrames local music
loop expansion and final mastering sample clocks were exercised with real speech.
The scoped Remotion gate also preserved opening decoded frames after the edit
and changed the final frames. Browser/SQLite creation retained all 40 supplied
passages in seven editable chapters.

RSS is sampled once per second and sums descendants, so shared pages can be
counted twice. These figures describe the fixture host, not speed or memory
promises. Audio is still assembled once per retry, so cached video does not make
export instantaneous. This is a bounded first long-video gate; heavy footage,
all quality/resolution combinations, pixel-based legibility audits, chapter-wise
AI topic generation and selective HyperFrames visual reuse remain follow-ups.

The bounded named-chapter append gate uses credential-free provider fixtures,
the rendered editor dialog, the registered MCP schema/forwarder and migrated
SQLite. It verifies one bounded generation invocation, preflight outline limits,
neighboring context, preserved earlier chapters/scenes/settings, atomic stock
metadata and chapter boundaries, and rejection of competing content/lock/order/
outline/add/delete/engine changes. Cancellation and metadata failure leave no
partial append. No rendering or audio behavior changes in this milestone.

```bash
npm test -- src/library/scene-append-scope.test.ts src/library/scene-append-service.test.ts src/library/ai-enhance-mcp.test.ts src/components/editor/ai-enhance-dialog.test.tsx 'src/app/api/scripts/[id]/ai/route.test.ts' src/providers/ai/prompt.test.ts
```

Topic writing-draft fixtures verify strict chapter/brief/count schemas, one bounded
provider invocation, capacity validation before quota reservation, preserved
storyboard/outline/settings, failure/cancellation/conflict preservation, draft-only
edits without provider work, revision restore, editor controls and shared REST/MCP
contracts. No rendering or audio code changes in this milestone.

```bash
npm test -- src/production/chapter-draft.test.ts src/library/chapter-draft-service.test.ts src/library/chapter-draft-mcp.test.ts src/components/editor/topic-chapter-draft.test.tsx 'src/app/api/scripts/[id]/chapter-draft/route.test.ts' src/providers/ai/prompt.test.ts
```

Reviewed chapter generation fixtures verify one explicit bounded call, pending-only
capacity, ordered chapter selection, provider quota checks before invocation,
atomic scenes/boundary/progress, preserved earlier work, retry after failure,
concurrent duplicate rejection, cancellation, stale edits, protected completion
metadata, empty-storyboard initialization and revision restoration with remapped
scene IDs. The editor, REST and registered MCP contract share a fixed single-call
budget. No renderer/audio changes or paid provider calls are needed for this gate.

```bash
npm test -- src/library/chapter-generation-service.test.ts src/production/chapter-draft.test.ts src/library/chapter-draft-mcp.test.ts src/components/editor/topic-chapter-draft.test.tsx 'src/app/api/scripts/[id]/chapter-draft/generate/route.test.ts' 'src/app/api/scripts/[id]/ai/route.test.ts'
```

Chapter type motif fixtures cover opt-in compatibility, deterministic per-chapter
choices, boundary anchors, whole/partial append equivalence, chapter outline
validation, protected scenes, unchanged content/audio, SQLite save/restore and
REST/MCP parity. Native still review uses three unrelated synthetic briefs across
portrait, landscape and square in both engines; it includes early reveal/hold
frames and reverse-order recapture. It creates bounded evidence sheets under
`.artifacts/chapter-motifs-<timestamp>/` without paid calls or long renders.
The September 30 gate passed 48 native stills and 8 additional reverse-order
recaptures. Decoded pixel hashes matched for all reverse recaptures. Explicit
2D transforms avoid seek-order-dependent text compositing in the new HyperFrames
motif branch; existing choreography stays unchanged when the saved field is absent.

```bash
node --import tsx scripts/verify-chapter-motifs.ts
npm test -- src/production/motion-plan.test.ts src/library/motion-direction-service.test.ts src/library/motion-direction-persistence.test.ts src/library/motion-direction-mcp.test.ts 'src/app/api/scripts/[id]/motion/route.test.ts' src/library/chapter-generation-service.test.ts
```

## Native reading-frame layout review

Both engines measure content text after fonts load, only in reading samples at
least one second into a scene and 0.4 seconds before its end. The HyperFrames
adapter wraps the pinned CLI's public Puppeteer screenshot method in an isolated
process, after its normal native seek and footage injection. It reads the frozen
frame immediately after that screenshot so diagnostic style/font reads cannot
affect its rasterization, and rejects unexpected/missing capture points. The existing
CLI retains image capture and media behavior. Remotion uses its review-only probe.
Native glyph metrics remove unused ascent/descent from measured text boxes.

Bounds and advisory clipping/safe-area findings are cached with the exact frozen
still revision. Conservative contrast warnings combine opaque native text paints
with sampled captured pixels; a warning requires even the strongest sampled
contrast to be below 3:1 for native large text or 4.5:1 for other text. This can
miss localized problems and is not an accessibility or whole-video quality score.
Transparent/gradient paints, strokes, shadows and blending are skipped. Captions,
chrome, unknown imported content and animated/cut frames retain manual review.
Coverage, checked counts and traversal limits accompany the evidence. Corrupt or
missing evidence requires recapture; failed measurement does not publish a
reading still. No provider calls or export/timing/audio changes are involved.

Run `node --import tsx scripts/verify-review-layout.ts` for bounded native reading
captures in both engines: clean and intentionally overflowing layouts in all three
ratios, native low-contrast copy, reverse point ordering, and pixel comparison
against capture without measurement. Evidence and stills are saved under
`.artifacts/review-layout-*`. Native proof is appropriate after changing this
adapter or upgrading its pinned dependencies; no long render matrix is required.

The October 1 gate passed 18 native still captures: 12 clean/overflow cases, two
additional portrait pixel comparisons using the deterministic Sweep fixture, and
four low-contrast samples in reverse order. Both engines returned the expected
warnings; clean samples stayed quiet and comparison hashes matched exactly.
The full suite passed 568 tests before the final guards; 20 focused checks then
covered native glyph metrics, late-chapter traversal, pixel contrast, caching and
rejected HyperFrames frame mismatches. Typecheck, lint, secret scan, release
contract and production build passed.

## Authored comparison, quiet and brand treatments

The October 1 choreography milestone completes the three remaining recipe
families with two distinct layouts each: Split/Stacked comparison, Quiet
divider/center and Brand lockup/frame. Inputs are existing scene copy, exactly two
supplied comparison labels (up to 60 characters each), and a usable supplied brand
name. No logo, comparison result or numerical claim is synthesized. Blank or
overlong brand names are omitted; authored scenes own brand placement instead of
repeating the legacy Remotion footer. Copy limits are 90/160/110 characters for
comparison/quiet/brand respectively. Shared geometry reduces type size for longer
copy and labels. Both engines preserve reading space and finish their authored
entrances early; quiet decorative motion ends at 2.4 seconds. Existing scene
lengths and creator cut timing remain authoritative.

Run `node --import tsx scripts/verify-story-motion.ts --baseline` to review the
existing generic preset on garden, workflow and archival fixture briefs before
adding a recipe. The normal command captures six authored treatments on those
briefs, distributed across portrait, landscape and square in both native engines.
It checks native clipping/safe-area findings and compares decoded hashes for
reverse seeking. `--limits` additionally checks wide-glyph copy/labels and the
wordmark at their supported limits; `--engine=remotion` scopes a follow-up after a
Remotion-only change. Evidence lives under `.artifacts/story-motion-*`.

The gate passed 48 authored native stills and 14 matching reverse recaptures,
plus 36 maximum-length native captures. Content measurements reported no
clipping/safe-area findings; all evidence sheets were manually reviewed. The
baseline comprised 18 native stills. The full 577-test suite passed with two
workers after media fixture timeouts under simultaneous capture load; 18 focused
motion checks then passed on the final code. The CI unit step also uses two
workers after an existing five-second SQLite fixture timed out under contention;
assertions and timeouts are unchanged. All 576 unit checks passed with this
exact command. Typecheck, lint, secret scan, fast
release contract and production build passed. No provider calls, dependencies or
long-render matrix were required.

## Narration-aware music cut review

The music panel and `suggest_narration_cuts` MCP tool share a read-only REST
proposal. Creators explicitly acknowledge the saved beat map and select a
recorded take. The service verifies the local audio checksum and rejects stale
maps or foreign takes. Suggestions stay within 350 ms of an existing cut, avoid
measured spoken words with 80 ms clearance, retain conservative copy-reading
holds and skip scene locks. Enabled beats and explicit drop markers repeat with
the music bed; cover offsets are included in displayed frames. Untimed,
placeholder, mismatched and appended narration cannot masquerade as silence.
Caption visibility does not affect speech protection. Suggestions never change
scene lengths, trims, narration, snapshots or exports; listen and direct any
manual timing changes separately.

Focused tests cover provenance, coverage, stale inputs, unchanged timing,
reading holds, locks, disabled anchors, drops, cover offsets, loops and MCP
parity. No AI/provider calls or dependency changes are involved.

The milestone gate passed 584 unit checks and the native three-second render
smoke check (585 total). The sandbox-only smoke attempt could not open a local
port; its rerun with local Chromium permissions passed. Typecheck, lint, secret
scan and production build passed.

## Selective HyperFrames visual reuse

Chapter exports now freeze a silent native visual project per 30-second section,
retaining the full endpoint, absolute scene/footage/caption timestamps and shared
chrome. Only active scenes and their local images/footage are copied. Each
section is planned by the pinned native producer; reuse hashes its actual
compiled artifacts, encoder/runtime versions and declared chunk dependencies.
Global coverage, dimensions and encoder identity must match the complete plan.
Assembly uses the original complete plan and freshly prepared continuous audio.
Checksum/packet-count verification and cancellation cleanup remain mandatory.

Catalog imports keep conservative whole-composition reuse because their scripts
and styles have not been proven independent of surrounding scenes. This change
adds bounded native planning per section, so a cold export can cost more even
when an edited retry saves capture/encoding work. It does not approximate frames,
retime media, alter default quality or add provider calls.

`node --import tsx scripts/verify-video-sections.ts --engine=hyperframes --edit --cancel`
uses a 62-second fixture with both unchanged and affected sections. It verifies
cold cancellation/retry, unchanged packet hashes and audio, selective edit
invalidation, full/scoped native still parity and continuous final mastering.

The 62-second native gate passed cancellation/retry, exact unchanged video/audio
hashes, two full/scoped still comparisons, selective invalidation of the two
sections touched by the final scene, and encoded loudness verification. All 587
unit checks passed; the additional native-plan worker check and 34 focused
caption/composition checks passed. Static native validation found a pre-existing
caption CSS font-stack escape error; CSS-string quoting now preserves font names
without allowing style-element injection, and the named fallback is localized.
A follow-up native caption parity capture verifies the corrected typography.

## Five-minute footage matrix and optional finishing experiment

`npm run benchmark:long-videos -- --finishing` runs six sequential local fixtures:
Remotion and HyperFrames at draft/standard 720p native coordinates and high 1080p
native coordinates. Each has exactly 300 seconds / 7,200 frames at 24 fps, ten
chapters, both supplied-media treatments, local eight-second footage that holds
its final frame, reading beats, captions, calibration narration, music and SFX.
The isolated database and exclusively created fixture media are cleaned; evidence
and MP4s remain under `.artifacts/long-video-benchmark-*`. No providers, dependency
installs or new duration allowances are involved. Every row checks exact coverage,
encoded resolution, audio around each section boundary, measured mastering,
unchanged audio/video retry hashes and native scene/transition stills. Reports
include wall time per video minute, warm retry time and sampled peak process-tree
RSS; missing memory samples remain explicitly unavailable. Native canvas and
encoded pixels are both retained because engine quality tiers scale differently.

The landscape device treatment uses adjacent media/copy columns so its frame,
headline and captions fit both source canvases. Native stills cover source
playback and a cut into footage; encoded review sheets sample each chapter at
+15 seconds, including held short-source frames. The pinned HyperFrames snapshot
CLI cannot clamp mid-scene seeks beyond a video's source duration, so those
later holds are reviewed from the delivery rather than stale CLI snapshots.

The explicit high-only finishing experiment blends three decoded frames with
weights 1:2:1, processing bounded silent sections before copying the complete
encoded audio. Temporal history resets at cuts. Existing outputs cannot be
overwritten; failed/canceled work leaves no deliverable or private scratch.
Source hashes, exact frame count/rate/dimensions/duration and encoded audio packet
hashes gate publication. This is causal temporal smoothing, not higher-sample
subframe motion blur. Moving copy can soften and lag by a frame; visual review
must decide whether that tradeoff helps. No default production path invokes it.
A native FFmpeg regression verifies exact coverage/audio, clean red-to-green cut
history, artifact protection and cleanup during cancellation.
