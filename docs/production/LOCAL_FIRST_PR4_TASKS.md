# Local-first PR 4 task ledger

Scope: Tasks 13–15 only. Base:
`4953489fc995a5e7d8eca96b21186e30a86b890d` (merged PR #11). Local `main`
and `origin/main` matched and the working tree was clean before creating
`feat/stock-media-workflow`. This branch is not stacked and remains local until
the user requests publication.

## Task cards

| Task | Implementation and acceptance                                                                                   | State    | Completion SHA                             |
| ---: | --------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
|   13 | Add manual provider/kind/orientation search, preview, attribution inspection, selection, replacement, and clear | Complete | `ed22d28eda7dd89445c4d660960d1e8bf32c2878` |
|   14 | Persist media preferences and deterministic/AI selection with explicit-choice precedence and visible fallback   | Complete | `54d40614259c452648dde5edb14d428c47f51584` |
|   15 | Render downloaded stock video and provider metadata through both engines in all three ratios                    | Complete | `c24fc49aa032423f8bbb9159e5bc55f7f45c629a` |

## Scope decisions

- Task 13 adds the explicit editor workflow over the provider-neutral services
  merged in PR #11. It does not add automatic selection or media preferences.
- Task 14 owns `auto/image/video/none`, bounded AI search intent, fallback
  ordering, and automatic no-result behavior.
- Task 15 owns render integration for stock video, deterministic mute/trim/
  reframe behavior, provider output metadata, and the cross-engine ratio matrix.
- Existing URL entry, uploads, assets, projects, REST/MCP behavior, engines,
  legacy templates, and no-stock operation remain supported.

## Task 13 — manual stock-media workflow

Completed at `2026-09-15T12:10:08+05:30` in
`ed22d28eda7dd89445c4d660960d1e8bf32c2878`.

- Added authenticated provider discovery and web-only search/select/clear REST
  routes over the provider-neutral registry. Selection requests contain only a
  provider asset id and the original strict search request; the server repeats
  the search and resolves the matching provider-owned candidate before any
  download or persistence.
- Added the scene-editor picker with provider, media-kind, and orientation
  filters; image/video previews; attribution and source links; select, replace,
  and explicit no-stock actions; provider health messages; and disabled states
  for unavailable providers, including the gated Coverr adapter.
- Selection materializes the provider-approved rendition, derives the render
  URL from the persisted local asset or compliant hotlink, and atomically saves
  the scene background with its immutable provider snapshot. Required usage
  reporting runs once without automatic failure retry and preserves its known
  reported or failed state.
- Clearing a selection or replacing its URL manually removes stale selection
  metadata while retaining cached media. Updating only image effects or video
  mute state preserves the matching attribution snapshot. Existing URL,
  upload, and asset-picker paths remain available.
- Added service and migrated-database coverage for server-side candidate
  revalidation, local background application, absent/stale results, usage-report
  failure state, atomic apply/clear behavior, metadata preservation, and cached
  asset retention. Stock provider errors now preserve their HTTP status and
  provider id at the REST boundary.

Validation:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test:unit` passed: 58 files, 308 tests.
- Focused workflow/repository/API-helper suite passed: 3 files, 6 tests.
- `npm run security:scan` passed.
- `npm run build` passed with the new dynamic provider, search, and scene
  selection routes included in the Next.js route manifest.
- `git diff --check` passed before the implementation commit.
- No Docker command, provider credential, remote provider request, push, or
  host-level change was used for this task.

## Task 14 — media preferences and automatic selection

Completed at `2026-09-15T12:29:17+05:30` in
`54d40614259c452648dde5edb14d428c47f51584`.

- Added the persisted `auto/image/video/none` scene preference and controls in
  AI project creation, AI append, and the scene inspector. Choosing `none`
  clears stock state and prevents automatic search; manual URLs, uploads,
  selected stock, existing scene backgrounds, and asset locks take precedence.
- AI plan contracts may return only a bounded search query and desired
  `image/video` kind. Both provider schemas and prompts prohibit provider ids,
  asset ids, and arbitrary render URLs. An explicit user kind overrides the AI
  kind, while `auto` uses the AI kind or a deterministic image default.
- Automatic selection uses stable candidate hashing and a documented provider
  order: Pexels, Pixabay, then Unsplash for images; Pexels then Pixabay for
  videos. It skips unavailable providers, persists materialized selection
  snapshots with new and regenerated scenes, and never retries provider usage
  events after a known failure.
- Every decision has a visible state and message. Creation and append flows
  report selected versus no-result behavior, while controls explain that
  unavailable or empty results retain the animated mood background.

Validation:

- `npm run typecheck`, `npm run lint`, and `npm run security:scan` passed.
- `npm run test:unit` passed: 59 files, 314 tests.
- Focused AI intent, deterministic selection, persistence, regeneration, and
  enrichment suites passed: 6 files, 29 tests; the repository persistence pair
  also passed independently: 2 files, 5 tests.
- `npm run build` passed.
- `git diff --check` passed before the implementation commit.
- No Docker command, provider credential, remote provider request, push, or
  host-level change was used for this task.

## Task 15 — deterministic stock-video rendering

Completed at `2026-09-15T17:13:31+05:30` in
`c24fc49aa032423f8bbb9159e5bc55f7f45c629a`.

- Added an explicit stock-media marker to the shared scene contract. Manual and
  automatic selections persist it, editor changes preserve it only while the
  selected URL remains unchanged, and stock-video audio is always muted in the
  editor, Remotion, and HyperFrames.
- Remotion starts provider video at frame zero, trims it to the owning scene,
  and uses a cover crop. HyperFrames emits the video as its own root-level timed
  clip with a zero media offset, exact scene duration, cover crop, and muted
  playback; scene scrims and native/catalog/preset overlays remain above it.
- Video production snapshots now freeze ordered provider selections alongside
  the script revision. Successful output records retain provider and asset ids,
  creator/source links, attribution, acquisition policy, selected rendition,
  terms revision, local content hash, and usage-report state. Version-1
  snapshots without this new field still parse with an empty selection list.
- Added a credential-free render regression that generates a local video with
  an audio stream and verifies both engines in portrait, landscape, and square.
  The check fails on wrong codec, dimensions, duration, blank foreground, or an
  audio stream leaking from the muted stock source.

Validation:

- `npm run typecheck`, `npm run lint`, and `npm run security:scan` passed.
- `npm run test:unit` passed: 59 files, 316 tests.
- Focused migrated-database, stock workflow, automatic selection, production
  output, REST, and MCP contract suite passed: 8 files, 42 tests.
- `npm run build` passed and included all stock-media and scene routes in the
  Next.js production route manifest.
- `npm run test:stock-video-render` passed both engines in portrait, landscape,
  and square. Each generated source contained audio; every output was H.264 at
  the expected dimensions/duration with visible content and no audio track.
- Installed `hyperframes check` passed lint, runtime, layout, motion, and
  contrast with zero findings for the generated portrait, landscape, and square
  compositions.
- The bundled Product Launch image fixture rendered successfully through both
  engines in portrait, landscape, and square.
- Browser acceptance against a fresh, migrated, separately seeded SQLite
  database verified provider/kind/orientation picker states, persisted `video`
  preference across reload, and persisted `none` behavior across reload. No
  provider search was submitted.
- The isolated web/worker process group was stopped after browser validation;
  port 3217 and the production-worker lock were both clear.
- `git diff --check` passed before the implementation commit.
- No Docker command, remote provider request, software installation, push, PR,
  merge, or computer setting change was used for this task.
