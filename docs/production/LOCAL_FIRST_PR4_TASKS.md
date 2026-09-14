# Local-first PR 4 task ledger

Scope: Tasks 13–15 only. Base:
`4953489fc995a5e7d8eca96b21186e30a86b890d` (merged PR #11). Local `main`
and `origin/main` matched and the working tree was clean before creating
`feat/stock-media-workflow`. This branch is not stacked and remains local until
the user requests publication.

## Task cards

| Task | Implementation and acceptance                                                                                 | State   | Completion SHA |
| ---: | ------------------------------------------------------------------------------------------------------------- | ------- | -------------- |
|   13 | Add manual provider/kind/orientation search, preview, attribution inspection, selection, replacement, and clear | Pending | —              |
|   14 | Persist media preferences and deterministic/AI selection with explicit-choice precedence and visible fallback  | Pending | —              |
|   15 | Render downloaded stock video and provider metadata through both engines in all three ratios                   | Pending | —              |

## Scope decisions

- Task 13 adds the explicit editor workflow over the provider-neutral services
  merged in PR #11. It does not add automatic selection or media preferences.
- Task 14 owns `auto/image/video/none`, bounded AI search intent, fallback
  ordering, and automatic no-result behavior.
- Task 15 owns render integration for stock video, deterministic mute/trim/
  reframe behavior, provider output metadata, and the cross-engine ratio matrix.
- Existing URL entry, uploads, assets, projects, REST/MCP behavior, engines,
  legacy templates, and no-stock operation remain supported.
