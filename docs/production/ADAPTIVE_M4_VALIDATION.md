# M4 creation workflow acceptance

Local acceptance recorded 2026-10-17 against the M4 feature branch. Latest-head
Linux/Windows CI, merge and refreshed local main are separate delivery gates
recorded by the milestone PR. This is milestone evidence, not a release or
model-quality certification.

## Implemented behavior

- Both supplied-content and configured AI planning use the existing shared
  repository, adaptive resolver, subject registry and frozen render contracts.
- On-demand contact sheet with four actual previews per page, supplied copy,
  visual purpose, sequence-boundary reasons, saved choices and timing labels.
- Draft animatic on the existing full-film player, with take/cover timing and
  readiness-driven playback; final export settings remain independent.
- Scene/chapter/film scope, review-before-apply, compatible variations and a
  source-hash/seed guard. Scope protects other scenes and film-wide settings.
- Existing whole-scene locks protect visual choices. Direction-only undo stores
  one previous set of affected layouts/settings in SQLite, checks its post-change
  source hash, and survives restart without overwriting intervening edits.
- Saved readiness status plus opt-in local structured-output tests, latency,
  requested language, configured context/output bounds, cancellation and deadline.
  Configuration changes/failing retests invalidate a saved passing probe.

## Local checks

- Full unit suite: **964 tests across 191 files passed**. The first sandbox run
  could not exercise loopback servers/process watchers; the complete run passed
  with those permissions. No dependencies or models were installed.
- Focused regression coverage includes preview without writes, exact reviewed
  seed application, foreign scope rejection, lock/content preservation, stale
  proposal rejection, SQLite reconnect/undo, provider schema validation and
  cancellation, endpoint authorization, cloud-probe rejection and saved probe
  invalidation across configuration-store restart.
- Typecheck, lint, secret scan and production build passed. The final focused
  check includes the readiness-triggered player transport and scope guards. An
  additional chapter-scope UI test passed; 57 focused builder/player/film-plan
  tests passed after wiring draft preview quality. Producer-mode HTML is
  identical with or without that preview setting.
- Browser inspection covers readiness states, actual contact-sheet previews,
  selected-scene review/apply, reconnect and successful persistent undo. The
  final browser pass checks animatic startup and the current summary labels.

## Saved review examples and actual exports

`node --import tsx scripts/verify-adaptive-creation.ts` is an opt-in acceptance
command that saves named examples and exports in the active app database. It
starts a temporary loopback OpenAI-compatible fixture, configures the real
adapter through its injectable store, and supplies the deterministic planner's
plan through that adapter. It does not replace the user's provider settings.

The two saved projects are **M4 · Supplied content** and
**M4 · Configured AI transport fixture**. Both retain identical admitted copy,
narration and structured inputs. The fixture is explicitly labelled: this tests
transport/schema parity and local admission, not an installed model's creativity
or faithfulness. No paid provider was called.

| Example                         | Canvas    | Accepted export          |
| ------------------------------- | --------- | ------------------------ |
| Supplied content                | 1080×1920 | 20 s, 600 frames, 30 fps |
| Configured AI transport fixture | 1920×1080 | 20 s, 600 frames, 30 fps |

Each has a silent timing take, immutable revision and accepted MP4 in the app's
render list. The fixture server stops before either isolated-worker export.
Scoped variation and undo run across a disconnected database connection before
snapshot/export; matching content is asserted. Export metadata is verified and
settled frames at 1.2, 6.2, 11.2 and 16.2 seconds are visually inspected for copy,
fit and readable geometry.

Browser evidence: [contact sheet](../assets/adaptive-m4/contact-sheet.png),
[reviewed variation](../assets/adaptive-m4/direction-review.png).
The final animatic starts from zero, advances in the shared player and pauses
correctly. The browser console reports no errors. The browser pass exposed an
existing dropped draft-preview setting; it is now forwarded to the builder,
with grain/text-blur savings restricted to preview and regression coverage
confirming unchanged producer output.

Exported frames: [portrait](../assets/adaptive-m4/portrait-scenes.png),
[landscape](../assets/adaptive-m4/landscape-scenes.png).

## Boundaries

No installed local model was configured for this acceptance; model availability,
fluency, source faithfulness, real context limits and model-side cancellation
remain things to test on a selected installation. A passed readiness probe only
proves admitted structured output for that configuration/language request and
records latency. Provider adapters keep their existing bounded repair policy.
The pinned CLI does not expose `usage`; usage is unknown. Exports use the
repository's pinned isolated native worker and existing local assets.

The workflow keeps existing Copy/Assets/Whole scene locks and the separate
subject-identity editor. It does not introduce a general layout/motion graph,
per-object lock graph, long-form direction policy or factory batching changes.
M5 and M6 remain separately authorized work. M0 blind visual preference targets
and the full release matrix are not established by these two synthetic films.
