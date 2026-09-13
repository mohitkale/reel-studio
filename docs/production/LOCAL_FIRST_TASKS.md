# Local-first PR 1 task ledger

Scope: tasks 1–4 only. Base: `5e6a4b74599ffa51cb3fc8e504db2fbba2ae713a`.
PR #8 merged at 2026-09-13T15:56:04Z; fetched main and origin/main match.
Initial tree was clean. Branch: `feat/production-worker-reliability`.
All commits remain local; publishing requires an explicit user request.
Existing AGENTS.md and AI_GUIDELINES.md provide the shared Codex instructions.

## Task cards

| Task | Implementation and acceptance                                                                                       | State       | Completion SHA |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ----------- | -------------- |
| 1    | Freeze installed/locked exact dependencies, API and license policies, source URLs and baseline fixtures             | Complete | `0e917f2`        |
| 2    | Supervise web/worker in dev, production and Docker; test signals, crash visibility and restart                      | Pending     | Pending        |
| 3    | Propagate abort into both render engines and supported encoders; test child termination, scratch cleanup and leases | Pending     | Pending        |
| 4    | Persist concrete stage outputs and invalidation keys; test immutable inputs, cache reuse and restart                | Pending     | Pending        |

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
