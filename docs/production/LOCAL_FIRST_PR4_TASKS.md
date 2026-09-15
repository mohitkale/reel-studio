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
|   14 | Persist media preferences and deterministic/AI selection with explicit-choice precedence and visible fallback   | Pending  | —                                          |
|   15 | Render downloaded stock video and provider metadata through both engines in all three ratios                    | Pending  | —                                          |

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
