# Local-first PR 2 task ledger

Scope: tasks 5–6 only. Base: `f4e7286cc222e1d6eea052fe225fe03a544cd448`.
PR 1 was merged before this branch was created. Branch: `feat/podcast-finishing`.

| Task | Implementation and acceptance                                                                                                                                                             | State    | Completion SHA |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------- |
| 5    | Persist intro/outro bumpers, explicit per-turn pauses, pronunciation substitutions, and immutable take finishing snapshots while retaining turn-cache reuse                               | Complete | `1d268a0`      |
| 6    | Add manual and timestamp-grounded clip selection, optional provider suggestions grounded back to saved transcript ranges, and three distinct acceptance briefs per preset on both engines | Complete | `0686ff1`      |

## Task 5 evidence

- The migration suite covers fresh and populated databases with safe defaults for
  existing podcasts, turns, and takes.
- Audio tests cover bounded FFmpeg decode, six-second bumpers, fades, timing
  shifts, explicit pauses, pronunciation-only cache invalidation, and unchanged
  unrelated turns.
- Focused podcast finishing tests, typecheck, and lint passed before commit.

## Task 6 evidence

- Grounding tests reject unknown, reversed, duplicate, and longer-than-90-second
  ranges; the same contract enforces a one-second minimum. Displayed quotes, timestamps, and selected
  IDs are derived from the immutable take timeline rather than provider copy.
- Manual selection and deterministic local suggestions work without an AI key.
  Optional AI generation is explicit, provider-neutral, strictly validated, and
  never retries an uncertain paid POST.
- `npm run release:matrix -- --resume` verified 36 H.264 outputs: six presets,
  three SHA-256-tracked briefs per preset, both engines, and all three
  orientations. The interrupted first invocation was resumed only from outputs
  that already existed locally; every reused file was probed again.
- HyperFrames and Remotion contact sheets were visually inspected. All 18 samples
  per engine contain visible, distinct brief copy; the three data-story samples
  show the exact `120 → 180`, `18 → 11 min`, and `24 · 21 · 19` evidence.
- Passing checks: typecheck, zero-warning lint, 12 focused tests across five test
  files, release contract, and Next.js production build.
- The compact committed render evidence is
  [LOCAL_FIRST_PR2_RENDER_MATRIX.json](LOCAL_FIRST_PR2_RENDER_MATRIX.json).
  Full MP4s, sampled frames, contact sheets, and the generated report remain in
  ignored `.artifacts` paths.

No Docker validation, dependency installation, host setting change, remote push,
or PR creation was performed for PR 2.
