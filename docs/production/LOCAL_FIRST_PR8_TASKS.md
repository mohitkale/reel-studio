# Local-first PR 8 task ledger

Scope: Tasks 26–29 only. Base:
`f4198ac45284313b39a0174733d24856aa4b51d2` (merged PR #15). Local `main`,
`origin/main`, and `HEAD` matched and the working tree was clean before creating
`feat/quick-produce`. This branch is not stacked and remains local until the
user requests publication.

## Task cards

| Task | Implementation and acceptance                                                   | State    | Completion SHA |
| ---: | ------------------------------------------------------------------------------- | -------- | -------------- |
|   26 | Off-by-default Quick Produce UI, immutable revision, durable reconnectable job  | Complete | `be1339b`      |
|   27 | Real local/optional-AI stages, reusable media/audio/composition/render outputs  | Complete | Recorded next  |
|   28 | Shared REST/MCP/batch Quick Produce semantics, limits, retry/cancel/idempotency | Pending  | —              |
|   29 | Release docs, examples, licensing, walkthroughs, and final Gate 5 validation    | Pending  | —              |

## Initial decisions

- Quick Produce reuses the existing durable `video` production job and PR 1
  orchestration. It does not introduce a parallel queue or renderer.
- PR 1's persisted stage keys remain compatible. User-facing labels use the
  Gate 5 wording for audio reuse and caption/scene timing.
- Every Quick Produce submission records an immutable `ProductionRevision`
  before enqueueing its linked job. The editable project remains independent.
- Existing prepared-script production, normal Create with AI, and non-Quick
  Produce batch rows remain compatible.
- No Docker command, dependency change, push, or PR creation is authorized by
  this session.

## Validation evidence

### Task 26

- Quick Produce is explicitly off by default. Enabling it persists the editable
  project, immutable `ProductionRevision`, and the existing durable `video` job.
- Editor progress reconnects from the job id, shows every persisted stage and
  submitted/current revision hash, and retains edit/download/retry/cancel paths.
- Revision conflicts preserve the completed snapshot and newer editable state;
  the user can restore the completed revision as a new project or submit the
  current project revision.
- Typecheck and the focused Quick Produce/revision/API/orchestrator suite passed
  (4 files, 19 tests). Completion commit: `be1339b`.

### Task 27

- Deterministic no-key planning and configured Gemini/OpenAI/Ollama/LM Studio
  planning use the existing strict plan schemas and project creation path.
- The worker synthesizes Quick Produce narration from the immutable snapshot
  with server-side Kokoro by default, or reuses a checksum-valid take/stage.
  Media, timing, composition, render, and verified outputs retain PR 1 cache and
  invalidation behavior.
- Interrupted uncertain paid voice work is never automatically replayed. Normal
  cancellation, leases, explicit retry, provider policy, stock fallback, and
  artifact verification remain shared with existing production.
- Typecheck, quiet lint, and focused orchestration, lease, stock, deterministic
  planning, Ollama, LM Studio, strict output, and voice-provider suites passed
  (8 files, 65 tests). No live local-model server or remote provider was started.
