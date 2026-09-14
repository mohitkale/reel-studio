# PR 1 review handoff

## Proposed title

Make local production workers supervised, cancelable, and resumable

## Proposed description

Normal startup previously left durable jobs dependent on route callbacks or a
manually launched worker. Active cancellation did not reach renderers, and the
video pipeline recorded placeholder stages. This change supervises web/worker
startup and recovery, terminates supported active rendering, and persists real
validated video-stage outputs against immutable submission snapshots.

Implementation includes bounded worker restarts, shutdown/lease recovery,
Remotion and HyperFrames cancellation, encoder/transcription child cleanup,
content-addressed local media, selected-audio validation/reuse, shared timing
and prepared composition artifacts, cache invalidation, and idempotent verified
output publication. The dependency/API/license baseline and four task cards are
recorded alongside validation evidence.

Compatibility: no database migration, dependency upgrade, REST/MCP request
change, engine change, or template upgrade. Existing queued video jobs snapshot
on first execution; new submissions snapshot immediately. Interrupted provider
operations require explicit retry. Remote stock remains network-dependent.
Docker starts the supervisor directly and includes process-tree and browser-extraction tooling; user data is
excluded from image build context.

Validation: typecheck, lint, unit/contract tests, security scan, production build,
fresh/populated database backup and restoration, legacy dual-engine regression,
real worker exports and active cancellation, stage-by-stage cancellation,
lease/restart/deduplication checks, and live dev/start crash/recovery/shutdown.
Docker image build and isolated fresh-database startup, worker crash/recovery,
and graceful shutdown passed (container exit 0). The task ledger records exact
evidence and completion commits.

Material considerations: process-tree tests target macOS/POSIX and Linux Docker;
Windows behavior has not been exercised. Remote stock still requires network
access. Docker disk capacity was exhausted during validation; the passing test used
bounded memory mounts for disposable caches and its database. Normal disk-backed
startup needs available space; cleanup/settings changes require approval.
Local immutable asset copies intentionally consume disk space and are
retained for reproducibility. No automatic retry of uncertain paid operations.

Scope is tasks 1–4 only. No PR 2 work, push, PR creation, or merge is included.

## Local commits

- `0e917f2`: frozen baseline and task cards (task 1).
- `799441a`: web/worker supervision (task 2).
- `fd31c5d`: cancellation and lease recovery (task 3).
- `dac6703`: immutable resumable video stages (task 4), plus tested lifecycle corrections.
- `65f4bb7`: cached artifact validation, interrupted media-copy repair, and regression coverage.
- `64a4f31`: Docker browser extraction and graceful signal forwarding.
- Final documentation/evidence commit: see local Git history.

## Changed-file groups

- Launch/runtime: package.json, scripts/supervise.mjs,
  scripts/production-worker.ts, Dockerfile, docker-compose.yml, .dockerignore.
- Cancellation/adapters: production-cancellation.ts, production-worker.ts,
  render-service.ts, hyperframes-render.ts, hyperframes-render-worker.mjs,
  audiogram-production-orchestrator.ts, local-transcription.ts, audio-production.ts.
- Pipeline/storage: production-service.ts, repositories/production-jobs.ts,
  video-production-orchestrator.ts, video-snapshot.ts, video-stage-media.ts,
  production/jobs.ts and production/video-snapshot.ts.
- Tests: worker-supervision, production-cancellation, production-jobs,
  video-production-orchestrator and database-migration suites;
  scripts/verify-production-worker.ts, scripts/verify-supervised-launchers.mjs,
  and the supervisor child fixture.
- Documentation: shared AI_GUIDELINES.md, README.md, LICENSING.md, frozen snapshot,
  task ledger, PR1_VALIDATION.json and this handoff. AGENTS.md already reuses the shared guidelines.
