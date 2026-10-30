# Evidence-backed creation acceptance

M3 integrates frozen research with creation, source review, saved remix settings
and the shared REST/MCP workflow. GitHub PR checks remain the delivery gate.

- Full local suite: 220 files, 1,111 passing tests; the paid-provider smoke skipped.
- Focused regressions cover supplied text/URL capture, linked evidence and conflicts,
  unsupported numeric copy, source-bound chart admission, draft/Quick Produce,
  capture/restore, lost-response reconnect and stale polling, remix selections,
  external mappings/provenance, MCP routing, scopes and paid quotas.
- Typecheck, lint, secret scan, release-contract check and production build pass.
  No dependencies or schema migrations added.
- Browser: supplied-source capture succeeds without a provider call; reconnect after
  reload returns the same revision. Excerpts/dates/gaps remain visible. Results
  show source review. Remix retains the explicit unavailable fixture writer/model
  instead of silently choosing deterministic or another AI provider.
- Active-app example: **Research M3 · Evidence and saved remix**, with a successful
  durable production and downloadable H.264 MP4. Portrait 1080×1920, 162 frames,
  30 fps, 5.4 seconds. Exported frame inspection retains synthetic 42% and 68%
  figures. SHA-256: `cdcf73b2402f9b5b1b9aaffb260b67cc711cdf518975b97b5b356f937cfb37ed`.
- Reproduce with `node --import tsx scripts/verify-research-creation.ts` against a
  running local app. It uses synthetic external/unverified evidence and silent
  timing; no paid calls, models, downloads or installations.

[Completed result and source review](../assets/research-m3/result.jpg) ·
[Exported numeric frame](../assets/research-m3/chart.png)

The first local export and process-supervision run were blocked by sandbox system
calls. The export and complete suite passed with normal local process access.
The failed synthetic example remains distinguishable by its failed production.

The first Windows PR run passed all M3 checks but timed out in two existing
voice-timing setup hooks while applying migrations directly to disk. That fixture
now stages the identical schema in memory and copies it once to the real test
file, matching other integration fixtures. All 130 schema entries, integrity and
foreign keys match direct migration; the five timing/reconnect tests pass locally.
All assertions and the 20-second setup deadline remain unchanged. Latest-head
platform checks remain required before merge.

Deterministic numeric admission is conservative and is not semantic fact checking.
Sources remain untrusted reference data. Citations describe provenance, not truth;
review claims, conflicts and gaps before publication. Live provider behavior remains
opt-in; offline fixtures do not certify current provider availability or charges.
