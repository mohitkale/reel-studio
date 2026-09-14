# Local-first PR 3 task ledger

Scope: tasks 7–12 only. Base:
`0df1a4c52b7b19341fbb15bfcdf2c3834b2fe6b5` (merged PR #10). Local `main`
and `origin/main` matched and the working tree was clean before creating
`feat/stock-media-providers`. This branch is not stacked and remains local until
the user requests publication.

## Task cards

| Task | Implementation and acceptance                                                                                        | State    | Completion SHA                             |
| ---: | -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
|    7 | Add provider-neutral image/video contracts, immutable selection snapshots, and an additive legacy Unsplash migration | Complete | `213ef014c183f6c7d15115e3bdba7e032c154f33` |
|    8 | Add provider capabilities/health registry, response cache, quota state, and safe idempotent materialization          | Complete | `3143f722e840da8de008f0b69fa45009322744b3` |
|    9 | Add Pexels photo/video adapter with auth, pagination, quota, attribution, rendition, and failure fixtures            | Pending  | —                                          |
|   10 | Add Pixabay image/video adapter with required 24-hour cache, temporary-preview handling, and failure fixtures        | Pending  | —                                          |
|   11 | Move Unsplash persistence, hotlink/`ixid`, attribution, and download-event tracking into the shared service          | Pending  | —                                          |
|   12 | Keep Coverr disabled behind the recorded license decision unless the license gate is resolved                        | Pending  | —                                          |

## Task 7 decisions

- Existing scene backgrounds remain in `Scene.layoutJson` or legacy
  `Scene.visual`, so preview and render behavior does not change.
- `StockMediaSelection` adds one immutable, Zod-validated provider snapshot per
  scene. Provider id, asset id, kind, and optional local asset id are also stored
  in indexed columns for later provider and materialization services.
- The migration recognizes `images.unsplash.com` and `plus.unsplash.com`,
  retains the exact HTTPS URL including `ixid`, records the provider-owned
  `hotlink` acquisition policy, and does not invent a photographer or remote
  asset id that the legacy scene never stored.
- Candidate and resolved-asset contracts bound URLs, dimensions, duration,
  rendition count, MIME types, attribution, acquisition policy, usage state,
  and local SHA-256 metadata. Downloaded selections require an existing local
  asset of the same media kind.
- No provider adapter, key UI, search workflow, automatic selection, or render
  behavior assigned to tasks 8–15 is included in Task 7.

## Task 7 validation

- Focused schema and migration suites: 2 files / 16 tests passed.
- Full unit suite: 49 files / 254 tests passed.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm run security:scan`, and the Next.js production build passed.
- A fresh isolated SQLite file applied all eight migrations through
  `20260914000200_stock_media_schema` successfully.
- The populated migration fixture covers both current `layoutJson` and legacy
  `visual` Unsplash backgrounds, validates every backfilled snapshot, retains
  `ixid`, and proves the original render JSON is byte-for-byte unchanged.
- No Docker command, dependency install, external provider request, or host
  setting change was used for Task 7.

## Task 8 decisions

- `StockMediaProviderRegistry` now exposes validated provider capabilities and
  health, bounds search pagination, validates provider ownership and acquisition
  policy, and routes search, resolve, and usage reporting without changing the
  legacy Unsplash entry point needed by Task 11.
- Provider responses use a canonical SHA-256 request key, bounded expiry, strict
  persisted validation, expired or corrupt entry invalidation, and in-process
  request coalescing. Live quota observations are persisted monotonically so an
  older completion cannot replace a newer quota state.
- Download validation permits HTTPS media only, rejects credentials and literal
  private or local hosts on every redirect, bounds redirects, time, and body
  size, and verifies MIME type, file signature, image dimensions, or probed video
  duration and dimensions before accepting bytes.
- Downloaded media is stored through the existing `AssetStore` under a
  content-addressed path. The materialization record links provider rendition,
  immutable checksum, and local `Asset`, and is reused only while the file and
  persisted metadata still match. Hotlink selections remain remote.
- Provider calls and paid acquisition operations are never retried
  automatically. Tasks 9–12 remain responsible for concrete provider adapters
  and their provider-specific policies.

## Task 8 validation

- Focused registry, cache, materialization, safe-download, and database suites:
  5 files / 26 tests passed.
- Full unit suite: 52 files / 264 tests passed.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm run security:scan`, `npm run release:check`, and the Next.js production
  build passed.
- A fresh isolated SQLite database applied all nine migrations through
  `20260914000300_stock_media_services`; a populated Task 7 database upgraded
  through the same migration successfully.
- Repository integration tests persisted and reloaded cache entries, enforced
  monotonic quota observations, and linked materializations to existing assets.
  Cancellation/error fixtures verified download stream and temporary probe-file
  cleanup.
- No Docker command, dependency install, external provider request, or host
  setting change was used for Task 8.
