# Local-first PR 1 task ledger

Scope: tasks 1–4 only. Base: `5e6a4b74599ffa51cb3fc8e504db2fbba2ae713a`.
PR #8 merged at 2026-09-13T15:56:04Z; fetched main and origin/main match.
Initial tree was clean. Branch: `feat/production-worker-reliability`.
All commits remain local; publishing requires an explicit user request.
Existing AGENTS.md and AI_GUIDELINES.md provide the shared Codex instructions.

## Task cards

| Task | Implementation and acceptance                                                                                       | State    | Completion SHA |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------- | -------------- |
| 1    | Freeze installed/locked exact dependencies, API and license policies, source URLs and baseline fixtures             | Complete | `0e917f2`      |
| 2    | Supervise web/worker in dev, production and Docker; test signals, crash visibility and restart                      | Complete | `799441a`      |
| 3    | Propagate abort into both render engines and supported encoders; test child termination, scratch cleanup and leases | Complete | `fd31c5d`      |
| 4    | Persist concrete stage outputs and invalidation keys; test immutable inputs, cache reuse and restart                | Complete | `dac6703`      |

## Audit decisions

The 29-task plan and 0.4 implementation audit agree on the PR 1 gaps.
Preserve repository/provider/engine/service boundaries and REST/MCP schemas.
Do not implement tasks 5–29, upgrade HyperFrames, add stock adapters, or add
Quick Produce UI. Existing prepared-script video submissions remain supported.
Persist snapshots before rendering so later editor changes cannot change a job.
Paid operations with uncertain completion require explicit retry, never automatic
replay after a worker lease expires.

## Baseline and validation fixtures

- Exact installed and lockfile versions, licenses, integrity and registry URLs:
  [LOCAL_FIRST_SNAPSHOT.json](LOCAL_FIRST_SNAPSHOT.json). Every direct installed
  version was compared with package.json and package-lock.json; all match.
- Existing contracts: CONTRACTS.md, production-jobs.test.ts,
  video-production-orchestrator.test.ts, production-batches.test.ts and REST/MCP
  contract suites. Keep existing assertions and extend coverage.
- Database: existing migration fixtures for fresh and populated databases.
- Rendering: scripts/render-regression.ts and existing legacy engine fixtures.
- Final gate: typecheck, lint, unit tests, security scan, production build,
  fresh/populated databases, REST/MCP, both-engine renders and worker lifecycle.

## API and licensing snapshot (2026-09-13)

These are implementation constraints for later assigned PRs, not new adapters.

- [Pexels](https://www.pexels.com/api/documentation/): Authorization header;
  /v1/videos/ replaces the old video path. Preserve attribution and returned
  quota headers; selected render assets use validated local materialization.
- [Pixabay](https://pixabay.com/api/docs/): API key, 24-hour response cache,
  temporary preview URLs and local selected assets; preserve source metadata.
- [Unsplash](https://unsplash.com/documentation) and
  [API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines):
  preserve hotlinked API image URLs including ixid, photographer attribution and
  download-event tracking. The reviewed guidance does not explicitly grant a
  video-render scratch-staging exception. Decision: do not authorize generic
  permanent downloads or claim offline reproduction for Unsplash; retain the
  compliant remote URL and require network access. Any staging exception needs
  explicit upstream clarification before task 11 enables it.
- [Coverr start](https://api.coverr.co/docs/start/) and
  [introduction](https://api.coverr.co/docs/): keep the license gate closed;
  the plan's conflicting API commercial-use statements are not a basis for
  enabling production use. No Coverr adapter is enabled by PR 1.
- [Ollama](https://docs.ollama.com/api/introduction): local API root /api,
  loopback port 11434; future native schemas and model discovery stay in the
  provider boundary.
- [LM Studio](https://lmstudio.ai/docs/developer/openai-compat): future /v1
  transport remains distinct from cloud credentials and provider configuration.
- HyperFrames producer 0.8.33 / CLI 0.8.27 remain pinned to the existing tested
  release. Current registry targets must be rechecked for task 24; upstream main
  is not evidence of a published package.
- Existing third-party obligations in ../LICENSING.md remain in force. The
  dependency snapshot records package metadata, not a relicensing decision.

## Validation evidence

Task 1: parsed every direct installed manifest and lock entry; exact versions
match with no prerelease targets. Read installed Next.js CLI and after() docs.
Completion SHAs are recorded by the next local ledger commit to avoid self-SHA
references. Actual Git timestamps are used without overrides.

Task 2 focused evidence: supervision and durable-job suites passed (9 tests).

Task 2 completion: `799441a`; focused tests and typecheck passed.
Task 3 focused evidence: real FFmpeg termination, stubborn-process SIGKILL,
Remotion cancel bridge, queued cancellation and lease recovery tests pass.

## PR 1 runtime and compatibility decisions

- No schema migration or dependency upgrade. Snapshot/invalidation data uses
  existing job input and step JSON columns. Old queued inputs are frozen when
  first executed; new service submissions capture their revision immediately.
- Video jobs consume existing editable scripts. Planning orders the frozen
  scenes; media resolution retains local content by hash and remote URLs;
  audio validates/reuses the selected take or records silent mode; timing
  reconciles narration and checks captions; preparation stores the validated
  engine composition; rendering and verification persist the MP4 and checksum.
- Retries retain successful stages. Owned transactions fence stage/output writes;
  output publication deduplicates and refreshes the verified checksum.
- Normal dev/start/Docker launchers supervise web and worker. Route fallbacks
  remain for explicit unsupervised setups. Worker startup waits for the web
  listener; local jobs resume after shutdown; uncertain provider work fails for
  explicit inspection/retry rather than automatic paid replay.
- HyperFrames receives its native abort signal. POSIX process-tree inspection
  also covers Chromium's detached process group; Docker includes procps for
  this fallback. Remotion uses its installed renderer cancellation API.
- Windows direct child termination remains available; POSIX/macOS and Docker
  are the process-tree validation targets for this PR.

Task 3 completion: `fd31c5d`. A stronger HyperFrames frame-capture test exposed
an orphaned detached Chromium process; the corrective change uses the producer's
native AbortSignal and bounds descendant cleanup. The regression then passed
with no new renderer PIDs remaining.

Task 4 implementation evidence: typecheck, lint, 44 unit-test files / 239 tests,
security scan and production build passed. Coverage includes stage-by-stage
cancellation, persisted resume, immutable revision retention, local asset
freezing, queued/expired cancellation, explicit retry, shutdown requeue,
REST/MCP contracts, and fresh/populated 0.4 backup/restoration. Both-engine
legacy regression passed. Real worker exports and capture-stage cancellation
passed with no remaining renderer child PIDs; final runtime checks are recorded
below after the implementation commit.

Task 4 completion: `dac6703`; corrective commit `65f4bb7` adds checksum-based
artifact invalidation, interrupted media-copy repair, and silent-timing cache
coverage. Final host checks against `65f4bb7` passed: production build followed
by typecheck, lint, 44 test files / 239 tests, and security scan. Running build
before typecheck avoids racing Next.js generated type files.

Local runtime evidence (ignored validation artifacts):

- `.artifacts/production-worker-1789320729016/evidence.json`: both engines
  exported verified MP4s; active cancellation returned canceled with no outputs.
  The runner also asserts duplicate submission, immutable inputs, all eight
  persisted stages, no leftover renderer PIDs/browser profiles, and no partial
  MP4 or HyperFrames scratch directory.
- `.artifacts/launcher-validation.json`: actual `dev` and `start` launchers
  returned HTTP 200, restarted an intentionally crashed test worker, and stopped
  both children cleanly.
- `.artifacts/render-regression/legacy/`: existing Remotion and HyperFrames
  regression MP4s passed.
- Unit coverage includes fresh/populated database migration and backup/restore,
  REST/MCP contracts, expired leases, restart/resume, duplicate outputs,
  cancellation at every stage, and real FFmpeg/process-group termination.

Docker gate passed after corrective commit `64a4f31`: the image includes `unzip`
for Puppeteer's browser extraction, and its default command directly executes
the supervisor so Docker SIGTERM reaches graceful shutdown instead of stopping
at npm. The isolated fresh database migrated successfully; GET /api/projects
returned 200 before and after an intentional worker crash; the replacement worker
started; stop logged worker SIGTERM and web exit 0, and the container exited 0.
Compose configuration validation and the security scan also passed.

Build evidence: a test-only Dockerfile used the unchanged lockfile and a copied
npm tarball cache with `npm ci --prefer-offline` to recover from registry timeouts.
All normal install scripts ran; Chromium extraction and Prisma generation passed.
The final command correction was applied as a metadata-only image derived from
that build. No application code was replaced for the runtime test.

The Docker storage limit caused ENOSPC in the first runtime attempt. The passing
isolated test used bounded memory mounts for `.next`, `/tmp`, and its fresh
SQLite database, with no existing database/media mounts. Normal disk-backed
startup still needs sufficient Docker disk space. No cleanup or Docker settings
change was performed; those require the user's approval. Test containers are
stopped; test images/cache are retained locally.

Final evidence is summarized in [PR1_VALIDATION.json](PR1_VALIDATION.json), with
raw Docker logs in `.artifacts/docker-runtime-final.log`. All PR 1 code gates are
satisfied under the documented isolated validation configuration. The complete
diff against main was reviewed for tasks 1–4 scope, compatibility, and whitespace;
no later-PR implementation, push, PR creation, or merge was performed.
