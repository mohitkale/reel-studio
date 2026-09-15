# Local-first PR 7 task ledger

Scope: Tasks 24–25 only. Base:
`224e6d197d54a44a7b7eb8b82daf5257af347986` (merged PR #14). Local `main`
and `origin/main` matched before creating `feat/hyperframes-catalog-sync`. This
branch is not stacked.

## Task cards

| Task | Implementation and acceptance                                     | State       | Completion SHA        |
| ---: | ----------------------------------------------------------------- | ----------- | --------------------- |
|   24 | Stable HyperFrames pair and deterministic catalog synchronization | Complete    | Recorded after commit |
|   25 | Capability selection and reviewed responsive carousel family      | In progress | —                     |

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
