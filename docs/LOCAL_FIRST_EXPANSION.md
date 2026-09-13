# Local-first expansion plan

- Status: reviewed plan only; implementation has not started
- Prepared: 2026-09-13
- Recommended future branch: `feat/local-first-expansion`

## Outcome

Extend Reel Studio 0.4 into a stronger local-first content studio with:

- optional Pexels, Pixabay, Coverr, and existing Unsplash stock images/videos
- manual stock-media search and deterministic or AI-assisted media selection
- Ollama and LM Studio planning without a cloud API key
- user-editable production caption styles shared by HyperFrames and Remotion
- a current, repeatable HyperFrames catalog synchronization workflow
- an optional Quick Produce flow that can complete an editable production through
  the durable worker
- completion of the worker, orchestration, podcast, and release-evidence gaps
  recorded in `docs/production/IMPLEMENTATION_AUDIT.md`

The standard flow remains:

**Choose an output → provide content → choose a style → produce → download.**

Quick Produce is an optional acceleration of this flow, disabled by default. A
finished Quick Produce result must still open as an ordinary editable project.

## Working agreement for the future session

Do not start this plan until the user explicitly asks in a new agent session.
At that point:

1. Read `AGENTS.md`, `AI_GUIDELINES.md`, this plan, and the 0.4 audit.
2. Verify the default branch, PR #8, current checkout, and working tree before
   creating a branch.
3. If PR #8 has merged, create `feat/local-first-expansion` from the updated
   default branch. If it has not merged, report the exact base choice and create
   the branch from `feat/premium-production` only when the user wants a stacked
   continuation.
4. Preserve existing commits and use actual completion dates.
5. Keep every commit local. Do not push or create/update a PR until the user
   explicitly requests it.
6. Complete one numbered task at a time, run its focused checks, review the diff,
   commit it, and record the SHA and evidence in a task ledger.

## Current baseline

- Reel Studio: 0.4.0
- Node: 24 LTS range (`>=24.15.0 <25`)
- Next.js: 16.3.4
- Prisma: 7.10.0
- Remotion family: exactly 4.0.523
- HyperFrames producer: 0.8.33
- HyperFrames CLI: 0.8.27
- AI providers: Gemini and OpenAI
- stock provider: Unsplash images
- catalog: 20 items pinned to upstream revision
  `c93c7654033282e1a66a662a39fb10b8ed273b7d`
- persistent jobs and a standalone worker are present; normal app/Docker startup
  does not supervise that worker

Freeze a new dependency and API snapshot at implementation time. Do not upgrade
to prereleases, and do not guess package versions. Keep all Remotion packages on
one exact version. Upgrade framework/database packages only when their migration
notes and the existing fresh/populated fixtures pass.

## Provider research and constraints

The implementation must encode provider-specific policy. A single rule such as
“always hotlink” or “always download” is not compliant across providers.

### Pexels

Pexels supports photo and video search, requires an API key in the
`Authorization` header, asks applications to link prominently to Pexels and
credit creators when possible, and documents default limits of 200 requests per
hour and 20,000 per month. Use the current `/v1/videos/` routes rather than the
deprecated path. Source: [Pexels API documentation](https://www.pexels.com/api/documentation/).

Planned policy:

- cache normalized search results and honor returned quota headers
- persist the creator, creator URL, media page URL, provider ID, and provider
  asset ID
- materialize the selected render rendition into Reel Studio's local media store
  so preview and export use a stable asset
- never present Reel Studio as a replacement stock library

### Pixabay

Pixabay supports image and video search. Its API requires a key, documents a
default limit of 100 requests per 60 seconds, requires API responses to be cached
for 24 hours, forbids permanent image hotlinking, and recommends storing video
locally. Search results should identify Pixabay as the source. Source:
[Pixabay API documentation](https://pixabay.com/api/docs/).

Planned policy:

- use a 24-hour provider-response cache keyed by normalized query and filters
- use remote URLs only for temporary search previews
- download selected images and videos through the validated media-ingestion path
- store source and contributor metadata with the local asset

### Unsplash

Unsplash requires API image URLs to be hotlinked, requires attribution, and
requires the returned download endpoint to be called when an image is used. Demo
applications are limited to 50 JSON requests per hour and approved production
applications to 1,000 per hour. Source:
[Unsplash API documentation](https://unsplash.com/documentation).

Planned policy:

- preserve the `ixid` parameter and use supported image transformation options
- use the returned hotlinked URL in search results and editor previews
- persist attribution and download-location metadata, and record whether the
  download event was successfully requested
- do not run an Unsplash image through the generic permanent-download policy

Task 1 must resolve one production-specific point against the then-current API
terms: whether a selected photo may be staged locally while creating a rendered
video. If staging is permitted, trigger the download endpoint and retain its
source record. If it is not, keep the compliant remote URL and label that export
path as requiring network access rather than claiming an offline-reproducible
render.

### Coverr

Coverr's current developer documentation requires an API key and describes 50
requests per hour for demo apps and 2,000 per hour for paid production status.
It requires Coverr attribution for API use. Sources:
[Coverr API start](https://api.coverr.co/docs/start/) and
[Coverr authentication](https://api.coverr.co/docs/auth/).

There is a release gate before enabling Coverr. Official pages currently contain
conflicting commercial-use language: the developer landing page says API content
is commercially licensed with attribution, while another API introduction says
free access cannot be used commercially. The future implementation must capture
the applicable API terms/license in `docs/LICENSING.md` or obtain maintainer
clarification. Until resolved, the adapter may be implemented behind an
experimental disabled flag, but it must not be advertised as production-ready.

### Ollama

Ollama's local API uses `http://localhost:11434/api` by default, requires no
authentication for local access, lists models with `GET /api/tags`, supports
JSON-schema structured output, and also exposes OpenAI-compatible `/v1` routes.
Sources: [API introduction](https://docs.ollama.com/api/introduction),
[model listing](https://docs.ollama.com/api/tags), and
[structured outputs](https://docs.ollama.com/capabilities/structured-outputs).

### LM Studio

LM Studio serves locally at `http://localhost:1234` by default, exposes
OpenAI-compatible `/v1/models` and `/v1/chat/completions`, and supports JSON-schema
structured output for capable models. Authentication is optional and can be
enabled with a local token. Sources:
[OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat)
and [local API quickstart](https://lmstudio.ai/docs/developer/rest/quickstart).

### HyperFrames

The checked-in release uses producer 0.8.33 and CLI 0.8.27. Upstream moved during
this review: the official repository release notes document 0.8.34 with preview,
download-validation, render, and catalog fixes plus 25 image carousel blocks,
while the upstream producer manifest was already at 0.8.36. Sources:
[HyperFrames releases](https://github.com/heygen-com/hyperframes/releases),
[producer manifest](https://raw.githubusercontent.com/heygen-com/hyperframes/main/packages/producer/package.json),
and [registry](https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/registry.json).

The implementation session must separately verify the stable versions actually
published to npm and pin one compatible producer/CLI set. Repository `main` is
research input, not proof that a package has been published.

## Architecture

### Unified stock media

Replace the image-only contract with a validated provider-neutral model:

```text
StockMediaCandidate
  providerId, providerAssetId, kind(image|video)
  previewUrl, sourcePageUrl, creator, creatorUrl
  width, height, durationSec?, orientation, mimeType?
  renderRenditions[], attribution, acquisitionPolicy

ResolvedStockAsset
  localAssetId? or compliantRemoteUrl
  provider snapshot, source revision/terms URL
  content hash?, selected rendition, usage-event state
```

`acquisitionPolicy` is provider-owned and may be `hotlink`, `download`, or
`download-preferred`. Search, preview, selection, materialization, attribution,
and usage tracking must be separate operations. Persist enough metadata to render
old projects when provider search results change.

Add provider registry methods for capabilities and health, plus bounded search,
resolve/materialize, and usage reporting. Store provider response caches in
SQLite with expiry and normalized request hashes. Selected downloaded assets use
the existing local media store and immutable hashes. Validate redirects, MIME,
magic bytes, dimensions, duration, and bounded file size before accepting media.

The scene preference is one of `auto`, `image`, `video`, or `none`. An explicit
upload/selection always wins. `none` prevents stock search. Automatic planning
may return a search intent and desired media kind; it may not return an arbitrary
render URL.

### Local AI providers

Keep `AIProvider` as the domain interface. Extract the current OpenAI-compatible
HTTP and structured-output behavior into a configurable transport, then expose
separate `openai`, `ollama`, and `lm-studio` adapters so defaults, model discovery,
health messages, and authentication remain provider-specific.

Persist provider configuration separately from API keys:

- base URL
- selected model
- temperature and optional context/output limits within bounded ranges
- optional local token for LM Studio
- last successful health/model discovery result

Allow loopback HTTP endpoints by default. Treat LAN endpoints as an explicit
opt-in setting, resolve hostnames before connection, reject redirects, and never
forward a cloud provider key to a local/custom host. Docker guidance should use
`host.docker.internal` where supported without weakening the public URL-ingestion
SSRF controls.

Structured output handling must try the provider's native JSON schema first.
Accept a complete JSON object or one explicitly fenced JSON object, then validate
the unchanged result with the existing Zod schemas. One bounded repair retry may
ask the same model to correct validation errors. Do not delete required fields,
coerce factual chart values, change template IDs silently, or fall back to
unvalidated text.

### Caption styles

Add a versioned caption-style snapshot to the production specification and
caption track. It contains:

- font family, size, weight, line height, letter spacing
- bottom/top/center position and horizontal alignment
- text color and active-word color
- background color/opacity, padding, radius
- outline and shadow
- maximum words per line and maximum lines
- highlight mode (`none`, `word`, `phrase`, `karaoke`)
- safe-area offsets by aspect ratio

Preset defaults resolve first, brand values may override compatible typography,
and explicit project/track values win. Preview and export receive the same
resolved snapshot. HyperFrames and Remotion implementations may differ internally
but must match measurements closely at fixed reference frames.

### HyperFrames catalog synchronization

Replace the split manual workflow with `npm run sync:hf-catalog`. It should:

1. read an explicit upstream commit/tag and stable package target
2. fetch the official registry and selected item manifests
3. classify examples, blocks, and components
4. validate paths, checksums, files, assets, dependencies, dimensions, timing,
   variables, and offline-render requirements
5. evaluate each item against Reel Studio capability rules
6. generate a deterministic version directory plus a typed capability manifest
7. preserve earlier version directories and saved-project references
8. emit an unsupported-items report with a concrete reason per item
9. produce no diff when run again against identical inputs

The app should select by scene role/capability/category and only then map to a
compatible item. Do not send the full registry to an AI prompt. Introduce a
small, reviewed carousel subset first; require local assets, unique IDs, seekable
timelines, responsive layouts, and successful reference renders before exposing
an item.

### Quick Produce and real orchestration

Add an off-by-default `Quick Produce` toggle to Create with AI. The submit action
first persists an editable project and immutable production input, then enqueues
the same job type used by REST/MCP. The worker executes real idempotent stages:

```text
validate
plan
resolve_media
synthesize_or_reuse_audio
time_captions_and_scenes
prepare_composition
render_export
verify_artifacts
```

Each stage stores an output snapshot and cache/invalidation key. If a user edits
the project while a job runs, the job finishes against its immutable revision
and the UI offers a clear choice to view that result or produce the new revision.

The non-AI path uses deterministic planning, uploads/bundled media, optional
stock, Kokoro, and either engine. Local-AI mode may use Ollama or LM Studio.
Failures keep the editable project and completed reusable outputs. Paid cloud
operations retain existing approvals and quotas.

Before relying on Quick Produce, make the normal launcher supervise web and
worker processes, including clean signals and failure reporting. Pass abort
signals through Remotion, HyperFrames, and FFmpeg wrappers; terminate supported
children with a bounded graceful timeout and cleanup. Do not automatically retry
an uncertain paid request.

## Sequential implementation and commit plan

Each row is a meaningful local commit target. Additional corrective commits are
allowed when a review or failing gate justifies them; do not split changes to
manufacture commit volume.

|   # | Task / commit theme                                                                               | Acceptance evidence                                                                                                                                                                                                 |
| --: | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Freeze the new package/API/license snapshot and create task cards                                 | Direct dependency targets, provider rules, source URLs, current branch/base, and fixtures recorded; no guessed or prerelease versions                                                                               |
|   2 | Supervise the web app and production worker                                                       | Development, production, and Docker launch both processes; signals stop both; worker crash is visible and recoverable                                                                                               |
|   3 | Propagate cancellation into render subprocesses                                                   | Queued cancel is immediate; active Remotion/HyperFrames/FFmpeg work terminates when supported; scratch files and lease state are correct                                                                            |
|   4 | Implement real idempotent video pipeline stages                                                   | Every named stage performs or reuses concrete work and persists an output/invalidation key; restart resumes after the last valid stage                                                                              |
|   5 | Add podcast intro/outro, pause, and pronunciation data contracts                                  | Values persist, affect production audio predictably, and do not invalidate unrelated turns                                                                                                                          |
|   6 | Add podcast finishing UI, timestamp-grounded clip suggestions, and missing 0.4 acceptance renders | Manual mode works without AI; suggestions quote only transcript ranges; three distinct rendered briefs per preset pass both-engine review                                                                           |
|   7 | Add unified stock-media schemas and migration                                                     | Existing Unsplash projects migrate; image/video candidates, attribution, acquisition policy, and selected asset snapshots validate                                                                                  |
|   8 | Add provider registry, response cache, quota state, and materialization service                   | Provider capabilities are discoverable; cache/expiry/idempotency and safe download fixtures pass                                                                                                                    |
|   9 | Implement Pexels photos and videos                                                                | Auth, orientation, pagination, rate headers, attribution, rendition selection, local materialization, and error fixtures pass                                                                                       |
|  10 | Implement Pixabay images and videos                                                               | 24-hour response cache, temporary previews, local selected assets, attribution, rate limits, and corrupt/expired URL cases pass                                                                                     |
|  11 | Bring Unsplash persistence and usage tracking into the shared service                             | Required hotlinks retain `ixid`; attribution and download-location state persist; no generic local-copy policy is applied                                                                                           |
|  12 | Implement Coverr behind the license gate                                                          | Current terms decision is recorded; adapter remains disabled if unresolved; enabled path covers auth, attribution, quota, original-stock filtering, and local rendition handling                                    |
|  13 | Add manual stock-media search, preview, select, replace, and clear UI                             | User can filter provider/media kind/orientation, inspect attribution, select a result, replace it, and choose no stock                                                                                              |
|  14 | Add media preferences and deterministic/AI selection                                              | `auto/image/video/none` persists; explicit choices win; AI returns bounded search intent only; fallback order and no-result behavior are visible                                                                    |
|  15 | Render downloaded stock video and provider metadata through both engines                          | Video is muted/trimmed/reframed deterministically, preview/export share it, all ratios pass, and output metadata retains source attribution                                                                         |
|  16 | Add local AI configuration and connectivity diagnostics                                           | Loopback defaults, optional token, selected model/settings, health messages, Docker guidance, and explicit LAN opt-in work without cloud keys                                                                       |
|  17 | Extract the shared OpenAI-compatible structured-output transport                                  | Existing OpenAI behavior and Zod validation remain unchanged; no credentials cross provider/base-URL boundaries                                                                                                     |
|  18 | Implement Ollama discovery and planning                                                           | Native health/model listing, schema output, timeout/cancel, missing model, offline server, malformed output, video plan, and podcast plan fixtures pass                                                             |
|  19 | Implement LM Studio discovery and planning                                                        | `/v1/models`, optional auth, schema output, server/model diagnostics, video/podcast plans, and malformed output fixtures pass                                                                                       |
|  20 | Add bounded JSON extraction/repair and local-model capability guidance                            | Whole/fenced JSON parse safely; one repair retry is observable; final Zod schemas remain strict; small unsupported models fail actionably                                                                           |
|  21 | Add versioned caption-style schemas, defaults, and migration                                      | Old tracks resolve to legacy appearance; six preset defaults snapshot reproducibly; invalid contrast/size/line limits are rejected or warned                                                                        |
|  22 | Add caption styling controls and saved presets                                                    | Font, size, weight, placement, alignment, colors, box, outline/shadow, word/line limits, and highlight mode update the live preview                                                                                 |
|  23 | Implement caption style parity in HyperFrames and Remotion                                        | Reference frames across both engines and three ratios pass safe-area, line-wrap, Unicode, long-copy, and karaoke checks                                                                                             |
|  24 | Upgrade HyperFrames and add deterministic `sync:hf-catalog`                                       | Stable published versions are pinned; legacy and new renders pass; repeated sync is diff-free; unsupported report and version retention pass                                                                        |
|  25 | Expose reviewed catalog capabilities and carousel family                                          | Planning uses capability IDs; a small carousel set passes both preview/export and three-ratio tests; saved projects keep their pinned version                                                                       |
|  26 | Add the off-by-default Quick Produce UI and immutable submission                                  | Toggle state is explicit; submit creates an editable project/job; refresh/reconnect shows exact stage progress and revision                                                                                         |
|  27 | Connect Quick Produce to the real local and optional-AI stages                                    | Fully local and Ollama/LM Studio paths produce verified artifacts; media/audio caches reuse unchanged work; failure leaves the project editable                                                                     |
|  28 | Extend REST/MCP/batches for media preferences and Quick Produce semantics                         | Shared schemas stay compatible; scoped automation respects provider/duration/paid limits; retry/cancel/idempotency and partial batches pass                                                                         |
|  29 | Complete release docs, licensing, examples, and full validation                                   | README/env/Settings/MCP docs match behavior; all advertised examples are app-produced; fresh/populated migration, browsers, audio, both engines, ratios, providers, local AI, security, and performance matrix pass |

## Milestone gates

### Gate 1 — reliable foundation, after task 6

- web and worker start together locally and in Docker
- active cancellation and restart recovery have real subprocess tests
- video stages perform concrete work and preserve caches
- original 0.4 podcast omissions are implemented
- three rendered briefs per preset are inspected, not only schema-tested

### Gate 2 — stock media, after task 15

- no-key/no-stock production still works
- Pexels, Pixabay, and Unsplash pass contract fixtures and attribution review
- Coverr is enabled only after its license gate passes
- manual and automatic selection work for images and videos
- provider-specific cache/hotlink/download behavior is proven
- both engines render selected stock video in all ratios

### Gate 3 — local AI, after task 20

- Gemini/OpenAI regressions pass
- Ollama and LM Studio each pass discovery, video plan, and podcast plan with at
  least one documented compatible local model when available
- absence of either server is a normal actionable status, not an app failure
- invalid or hallucinated structures never bypass Zod validation

### Gate 4 — captions and HyperFrames, after task 25

- caption appearance matches preview/export across both engines and three ratios
- old caption tracks retain the 0.4 look
- HyperFrames versions are stable npm releases and the full legacy matrix passes
- catalog sync is deterministic, version-retaining, and does not expose rejected
  upstream items
- carousel examples use supplied/local media and seek correctly

### Gate 5 — Quick Produce and release, after task 29

- one credential-free brief produces an editable verified video unattended
- Ollama and LM Studio Quick Produce paths pass when locally configured
- a stock-free path and each stock provider fallback path behave predictably
- refresh, worker restart, duplicate submit, cancellation, and retry do not
  duplicate completed work
- batches preserve successful outputs when another row/provider fails
- README claims, gallery examples, licenses, and setup steps match the shipped app

## Test matrix

Run focused unit/contract tests after each task, then broader checks only at the
milestone gates.

Required fast checks:

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run security:scan`
- formatting check for changed documentation/code

Required focused coverage:

- provider response fixtures for authentication, rate limits, quota headers,
  timeouts, redirects, stale URLs, malformed JSON, no results, and attribution
- safe media downloads for MIME spoofing, corrupt media, decompression/file-size
  bounds, duration/dimension bounds, private-network redirects, and partial files
- local AI health/model discovery, structured output, cancellation, model unload,
  authentication, invalid JSON, schema mismatch, repair exhaustion, and no server
- worker supervision, crash/restart, lease expiry, duplicate idempotency key,
  cancellation at every stage, and interrupted child-process cleanup
- caption visual fixtures for every style across both engines and three ratios,
  including Unicode, RTL where supported, long words, safe areas, and active-word
  boundaries
- stock image/video reference renders with license/attribution metadata preserved
- Quick Produce browser checks for off-by-default behavior, progress reconnect,
  revision conflicts, editable result, download, and failure recovery

At gates, run the production build, legacy render regression, relevant preset
matrix, short real MP4/audio verification, fresh database, populated 0.4 upgrade,
and restoration test. Live provider tests are optional and run only when their
keys/local servers are configured; CI uses deterministic fixtures.

## Scope boundaries

- no generative-video provider integration
- no social publishing, hosted accounts, billing, or desktop packaging
- no arbitrary model-generated HTML, JavaScript, React, or executable composition
- stock media remains optional and is never required to produce a project
- local AI may be slower or less reliable depending on the selected model; the UI
  reports capability and validation failures instead of weakening output schemas
- provider media remains subject to its source license and API terms; attribution
  data travels with the project and artifact bundle
- saved projects retain engine, template/catalog version, caption snapshot, media
  source, and resolved assets so upgrades do not silently restyle them

## Fresh-session handoff

When the user asks to begin, the future agent should report the verified base and
new local branch, create the task ledger, and start with task 1. It should not
repeat broad product research unless an official source has changed, and it
should not skip the carry-over tasks in order to start the more visible UI work.
