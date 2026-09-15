# Local-first PR 6 task ledger

Scope: Tasks 21–23 only. Base:
`0fdb74c0bd3495b7f613603db14e5d9654860a68` (merged PR #13). Local `main`
and `origin/main` matched before creating `feat/caption-styling`. This branch is
not stacked.

## Task cards

| Task | Implementation and acceptance                                       | State    | Completion SHA                             |
| ---: | ------------------------------------------------------------------- | -------- | ------------------------------------------ |
|   21 | Versioned caption styles, preset defaults, validation and migration | Complete | `b98338aca273210693267ca3bad156b1dfd5de09` |
|   22 | Persisted caption appearance controls and live preview              | Complete | `f61766b07e269b1e44b3aa6fc5f8a7e08288f6aa` |
|   23 | Shared Remotion and HyperFrames caption rendering                   | Complete | `badd643baa44b5ed83e47ded33185a56037a5296` |

## Task 21 — versioned snapshots and migration

Completed at `2026-09-15T22:30:48+05:30` in
`b98338aca273210693267ca3bad156b1dfd5de09`.

- Added strict version 1 caption-style snapshots for typography, placement,
  colors, box, outline, shadow, wrapping, highlight mode and per-ratio offsets.
- Added deterministic legacy, minimal, editorial, karaoke, technical and
  cinematic presets. All six production presets resolve a stable default.
- Added nullable `CaptionTrack.styleJson`. Null rows and older production specs
  resolve to the legacy 0.4 style; no existing track is rewritten.
- Invalid colors, sizes, line limits and treatment bounds fail Zod validation.
  Low contrast produces an actionable warning without silently changing colors.

Focused validation: caption style, production spec, composition resolution, and
fresh/populated migration suites passed (4 files, 40 tests). TypeScript and
ESLint passed.

## Task 22 — controls and saved presets

Completed at `2026-09-15T22:33:56+05:30` in
`f61766b07e269b1e44b3aa6fc5f8a7e08288f6aa`.

- Added a preset selector and controls for font, size, weight, line height,
  letter spacing, position, alignment, text/active/box colors, box opacity and
  spacing, radius, outline, shadow, word/line targets, and highlight mode.
- The in-dialog preview updates immediately. Saving validates the complete
  snapshot at the route and repository boundaries, persists it on the selected
  track, and refreshes the editor preview.
- Imported, estimated and locally transcribed tracks start from the production
  preset. Re-estimating an existing track preserves its explicit style.

Focused validation: TypeScript, ESLint, changed-file Prettier, and diff checks
passed.

## Task 23 — engine parity

Completed at `2026-09-15T22:39:30+05:30` in
`badd643baa44b5ed83e47ded33185a56037a5296`.

- Remotion and HyperFrames resolve the same font sizing, spacing, placement,
  safe offsets, color, background, outline, shadow and wrapping measurements.
- Word, phrase and progressive karaoke highlighting use the existing cue/word
  frame boundaries. HyperFrames emits deterministic timed clips and its seek
  bridge updates active words during editor playback.
- Direction-aware markup, Unicode text, unbroken long-word wrapping, three-ratio
  safe areas and legacy natural wrapping are retained without dropping text.

Focused parity validation passed across portrait, landscape and square, covering
Unicode, RTL text, long words, safe areas, active-word boundaries and timed
HyperFrames clips (3 files, 25 tests). TypeScript and ESLint passed.

## Gate 4 caption validation

- `npm run test:unit`: 72 files and 366 tests passed.
- `npx vitest run src/library/database-migration.test.ts`: 1 file and 14 tests
  passed, including the populated-database caption-style migration.
- `npm run test:render`: Remotion and HyperFrames both produced decodable legacy
  MP4 regressions in `.artifacts/render-regression/legacy/`; visual inspection
  confirmed readable captions and retained legacy placement.
- `npm run typecheck`, `npm run lint -- --quiet`, `npm run security:scan`,
  `npm run release:check`, `npm run build`, and `git diff --check` passed.
- Prettier passed for every changed TypeScript, JavaScript, JSON and Markdown
  file. Repository-wide `npm run format:check` still reports the existing
  formatting baseline in 171 unchanged files.
