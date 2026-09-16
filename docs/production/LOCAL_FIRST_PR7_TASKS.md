# Local-first PR 7 task ledger

Scope: Tasks 24–25 only. Base:
`224e6d197d54a44a7b7eb8b82daf5257af347986` (merged PR #14). Local `main`
and `origin/main` matched before creating `feat/hyperframes-catalog-sync`. This
branch is not stacked.

## Task cards

| Task | Implementation and acceptance                                     | State    | Completion SHA                             |
| ---: | ----------------------------------------------------------------- | -------- | ------------------------------------------ |
|   24 | Stable HyperFrames pair and deterministic catalog synchronization | Complete | `16d8ebba663bbd5805bd053914fcf50b9e7c315d` |
|   25 | Capability selection and reviewed responsive carousel family      | Complete | `d72d578ca068ffc579011840cadf72e886cec0e2` |

## Task 24 — stable package pair and deterministic synchronization

- Pinned HyperFrames producer and CLI to the matching stable 0.8.40 release,
  and pinned the registry selection to release `v0.8.40` at immutable revision
  `cfe5dcfad310ced2a5844998628daa2b8a0f53d7`.
- Replaced the two manual import/embed scripts with `npm run sync:hf-catalog`.
  The synchronizer validates the official registry, manifests, file paths,
  variables, dependencies, declared assets, offline runtime requirements, and
  package/tag alignment before writing an immutable version directory.
- Generated a typed capability manifest and exhaustive unsupported-item report.
  The reviewed selection contains 23 items, including three native carousel
  adapters; all other 385 upstream items have a concrete review reason. Earlier
  catalog versions remain available.
- Native adapters retain upstream file checksums for review while excluding the
  upstream demo artwork and compositions from committed runtime files.
- Repeated synchronization reported 35 unchanged files and produced a
  byte-identical directory. It refuses to mutate a retained revision.
- Upgraded checker compatibility while retaining the 0.4 caption position and
  adding explicit metadata for intentional caption overlays.

Focused validation: catalog synchronizer/import/version tests and HyperFrames
composition tests passed (3 files, 25 tests). The real HyperFrames MP4 regression
rendered successfully. HyperFrames CLI 0.8.40 passed lint, runtime, layout,
motion, and contrast checks; its two legacy-caption occlusion observations are
informational.

## Task 25 — capability selection and carousel family

- Added stable planner-facing capability IDs and one mapping boundary from
  capabilities to engine-specific template IDs. OpenAI-compatible, Gemini,
  Ollama, and LM Studio structured outputs now select capabilities while saved
  scenes and adapters retain their existing template IDs.
- Exposed the reviewed Circle, Path, and Vision carousel blocks through native
  adapters. Each requires at least three project-supplied images, uses no
  upstream sample artwork, and renders through one deterministic paused GSAP
  timeline with responsive portrait, square, and landscape layouts.
- Resolved every scene image reference for editor preview and production export,
  materialized local render assets, and retained the saved HyperFrames catalog
  revision in prepared video snapshots. Projects pinned to an earlier revision
  cannot silently acquire the new carousel adapters.
- Extended the real render regression with all three carousel variants and
  foreground checks at every scene midpoint in all three aspect ratios.

Focused validation: 73 unit-test files and 379 tests passed. Real H.264
HyperFrames carousel renders passed in portrait, square, and landscape. CLI
0.8.40 reported zero runtime, layout, motion, or contrast findings in every
ratio. Its remaining lint warnings are advisory consequences of the regression
fixture intentionally reusing three images across three scenes and emitting all
three scenes in one generated HTML file.

Gate 4 validation passed: production build, typecheck, quiet lint, secret scan,
release contract (36 plans, 36 capabilities, 18 offline HyperFrames variants,
and four bundled artifacts), both legacy engine MP4 regressions, and the full
36-output preset/brief/orientation/engine release matrix.
