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
|    9 | Add Pexels photo/video adapter with auth, pagination, quota, attribution, rendition, and failure fixtures            | Complete | `ebe86bb51081fe705a4d0b2be9f17c93de2eed1f` |
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

## Task 9 decisions

- The built-in provider-neutral registry now includes Pexels photos and videos.
  Pexels key management remains server-side through `PEXELS_API_KEY` and the
  existing Settings secret route; provider health performs no billable or quota
  consuming request.
- Search uses the documented `Authorization` header, `/v1/search` photo route,
  and current `/v1/videos/search` route. Orientation, page, and the documented
  maximum 80-result page size are explicit, and opaque page tokens are validated
  before a request.
- Successful `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, and
  `X-Ratelimit-Reset` headers are parsed together and persisted through the
  shared quota service. Search results use the existing canonical cache with a
  24-hour Pexels TTL, following the provider's current cache guidance.
- Candidates retain the Pexels asset id, media page, creator name and profile,
  required Pexels attribution, orientation, duration, and provider-owned
  `download` policy. Photo materialization uses the returned original URL.
  Video HLS entries and entries without dimensions are excluded; deterministic
  selection chooses the smallest rendition meeting the target canvas, or the
  largest usable fallback.
- Selected bytes pass the shared redirect, MIME, signature, dimension,
  duration, and size checks before content-addressed local persistence. Search
  timeouts, network failures, authentication failures, rate limits, malformed
  JSON, malformed fields, and inconsistent pagination fail once without an
  automatic retry.
- No Pixabay, Unsplash shared-service migration, Coverr enabling, stock picker,
  automatic media selection, or render integration from Tasks 10–15 is included.

## Task 9 validation

- Pexels fixture suite: 13 cases covering capabilities and health, photo and
  video mapping, authorization, orientation, pagination, quota persistence,
  response caching, attribution, rendition selection, safe local
  materialization, provider errors, malformed responses, timeout, cancellation,
  HLS filtering, and no-retry behavior.
- Focused stock-media suites: 4 files / 25 tests passed. Full unit suite: 53
  files / 277 tests passed.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm run security:scan`, changed-code Prettier checks, and the Next.js
  production build passed.
- Installed Next.js 16 route-handler, server/client boundary, and environment
  variable documentation was reviewed before changing the Settings route and
  client card.
- All provider tests used deterministic local fixtures. No real key, external
  provider request, Docker command, dependency install, or host setting change
  was used for Task 9.
