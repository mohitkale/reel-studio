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
|   10 | Add Pixabay image/video adapter with required 24-hour cache, temporary-preview handling, and failure fixtures        | Complete | `273710b45bfe2bd4404d1b658fde4f9bd1043862` |
|   11 | Move Unsplash persistence, hotlink/`ixid`, attribution, and download-event tracking into the shared service          | Complete | `681c09cc4efa57e57eb8fd70bfabeacff9f3dd08` |
|   12 | Keep Coverr disabled behind the recorded license decision unless the license gate is resolved                        | Complete | `b2164c3c4a0ad3b9d097f2823cc4359775f2cffe` |

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

## Task 10 decisions

- The built-in registry now includes Pixabay image and video search, while the
  API key remains server-side through `PIXABAY_API_KEY` and the existing
  Settings secret route. Provider health does not make a network request.
- Searches use Pixabay's image and video endpoints with the key in the query
  string, enforce the documented minimum page size and 100-character query
  limit, and map orientation and pagination through the shared contracts.
- The shared cache uses Pixabay's required 24-hour lifetime. The key is excluded
  from the canonical cache request, and limit, remaining, and relative reset
  headers are validated together before quota state is persisted.
- Image search URLs are treated as temporary previews. Selected image and video
  renditions use the provider-owned `download` policy and pass shared media
  validation before content-addressed local storage. Resolution refreshes an
  asset by provider id before materialization so expired result URLs are not
  reused.
- Candidates retain the Pixabay item id, source page, contributor link,
  required attribution, dimensions, duration, and usable rendition metadata.
  Authentication, rate-limit, provider, malformed response, corrupt download,
  expired URL, timeout, and cancellation failures occur once without retry.
- No Unsplash shared-service migration, Coverr enabling, stock picker,
  automatic media selection, or render integration from later tasks is
  included.

## Task 10 validation

- Pixabay fixture suite and focused stock-media suites: 5 files / 39 tests
  passed, including the exact 24-hour cache boundary, quota reset conversion,
  expired-URL refresh, corrupt-media rejection, local image/video persistence,
  timeout, cancellation, and no-retry cases.
- Full unit suite: 54 files / 291 tests passed.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm run security:scan`, changed-code formatting, and the Next.js production
  build passed.
- Existing Pexels registry coverage was retained while adding Pixabay to the
  default provider set. All provider requests used deterministic local
  fixtures.
- No real key, external provider request, Docker command, dependency install,
  or host setting change was used for Task 10.

## Task 11 decisions

- Unsplash is now a provider-neutral image adapter in the built-in registry.
  The existing image-only entry point delegates to it so automatic scene
  backgrounds and existing REST behavior remain compatible.
- Search keeps the exact returned `images.unsplash.com` or
  `plus.unsplash.com` hotlinks, including `ixid`, and adds the required Reel
  Studio referral parameters only to photographer and photo-page attribution
  links. The API key stays in the `Authorization` header.
- Immutable provider snapshots now retain the validated
  `links.download_location` endpoint alongside photographer, attribution,
  source page, asset id, dimensions, rendition, and hotlink policy. The shared
  usage service persists `reported` or `failed` state and does not
  automatically retry either state.
- Hotlink materialization stores no local bytes and returns the exact selected
  remote rendition, so Unsplash renders remain network-dependent. This follows
  the Task 1 decision that the reviewed guidance does not grant a local
  render-staging exception.
- The returned download endpoint is accepted only on `api.unsplash.com` and
  only for the selected asset id. Usage calls, search calls, timeouts, and
  provider errors occur once without retry.
- No stock picker, automatic provider choice, downloaded-stock rendering, or
  later-PR workflow is included.

## Task 11 validation

- Focused Unsplash, registry, schema, materialization, Pexels, and Pixabay
  suites: 6 files / 52 tests passed. Coverage includes exact `ixid` retention,
  attribution/referral links, quota and pagination, no local download, persisted
  usage success/failure, legacy delegation, malformed data, foreign URLs,
  cancellation, timeout, and no-retry behavior.
- Full unit suite: 54 files / 298 tests passed.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm run security:scan`, changed-code formatting, and the Next.js production
  build passed.
- Current official Unsplash API documentation and API guidelines were reviewed
  on 2026-09-15. All API interactions in tests used deterministic local
  fixtures; no real credential or provider API request was used.
- No Docker command, dependency install, or host setting change was used for
  Task 11.

## Task 12 decisions

- The Coverr license gate remains closed after reviewing the official API
  introduction, API start page, developer page, and general license on
  2026-09-15. The API introduction excludes commercial use for free access,
  while the developer and general license pages state that commercial use is
  allowed; the tier page does not identify which terms control this use case.
- The built-in registry exposes `Coverr (disabled)` with disabled health so the
  decision is inspectable. Search fails locally with a license-gate error before
  reading a key or making a network request.
- Coverr is absent from the supported key-management ids, `.env.example`, and
  Settings. No production-ready claim, key prompt, remote search, media
  selection, or local rendition path is reachable while the gate is closed.
- Enabling the adapter requires written API-specific clarification followed by
  provider fixtures for authorization, attribution, quota, original-stock
  filtering, safe local rendition handling, and provider errors. That
  conditional implementation is intentionally not guessed while the release
  gate remains unresolved.
- No Task 13 picker or later workflow work is included.

## Task 12 validation

- Focused provider and schema suites: 6 files / 50 tests passed. Coverr-specific
  fixtures verify the dated source decision, disabled registry health, absence
  from key settings, a local 451 search failure, and zero network calls even
  when an unused Coverr-like environment value exists.
- Full unit suite: 55 files / 301 tests passed.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm run security:scan`, changed-code formatting, and the Next.js production
  build passed.
- All provider interactions in tests used deterministic local fixtures; no real
  credential or provider API request was used.
- No Docker command, dependency install, or host setting change was used for
  Task 12.
