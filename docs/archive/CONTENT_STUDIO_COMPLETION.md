# Content studio completion (historical)

Follow-up to [PR #57's original milestone](CONTENT_STUDIO_REVIEW.md).
Current usage is documented in the [creator guide](../CREATOR_GUIDE.md) and
[factory guide](../FACTORY_WORKFLOWS.md).

## Delivered

- Transactional create/delete/reorder, scene and script-setting undo/redo, plus
  grouped editor AI rewrite/append history. Restores selected voice clips and
  stock snapshots; conflicts preserve newer work. Existing history is compatible.
- Asset usage scans frozen revisions, queued jobs, profiles, finishing snapshots
  and saved history. Deletion protection preserves referenced dependencies.
- Database-backed audio plans and undo cursors, optimistic revision checks,
  reload recovery and idempotent edited takes. Source audio remains unchanged.
  Video timing supports intentionally removed scenes without adding them back.
- Separate reviewed language projects with manual translation by default and
  optional configured-provider previews. Design, series and audio settings are
  preserved; original takes/captions are not copied. Stale source checks prevent
  applying a translation to changed content.
- Local Whisper transcription for imported/recorded podcast takes, editable
  transcript/speaker review, cancel/retry controls, and immutable reviewed takes
  sharing existing audio. Deleting a shared take preserves its siblings' bytes.

## Validation and resource policy

Active-database examples are labelled **Factory completion**. The local fixture
`scripts/verify-studio-completion.ts` reuses cached Kokoro, disables remote model
fetching, creates real narration and an edited take, verifies the shared video
timeline and unchanged source checksum, imports speech, and runs local Whisper.
It resumes saved example IDs to avoid duplicate synthesis and recordings.

The user approved one multilingual Whisper small model download, verified against
its published SHA-256. No extra software, translation model or paid API calls were
used. Optional AI translation uses fixture provider coverage; the manual workflow
is the free live path. Whisper does not infer speaker identity. Partially cut
transcript passages and text embedded in visual assets require human review.

## Completion checks

- 207-file local suite covered every test; one existing FFmpeg mastering test
  timed out under load and passed in an isolated rerun. Final focused recorder
  and omitted-scene regressions also passed. Platform CI remains the merge gate.
- TypeScript, ESLint, secret scan, production build, 18 composition contracts,
  migration/backup/rollback and isolated fresh setup passed before live checks.
- Real cached Kokoro → saved plan → edited take → H.264/AAC export: portrait,
  2.8 seconds, one retained scene. Source audio SHA-256 remained unchanged.
  Decoded audio is non-silent and below clipping. Preview/export frames inspected.
- Browser checks: saved plan undo/save/reload/redo, manual Spanish version and
  reload, scene creation undo/redo across reload, real Whisper transcript review,
  shared-audio reviewed take and valid downloadable episode package.
- An explicitly approved short physical microphone recording was saved locally
  and labelled as a microphone test. Capture stopped; no speech provider was used.
- Desktop preview at 1280 pixels and phone editor at 390 pixels were inspected;
  the phone document had no horizontal overflow. The translated workspace also
  remained usable at 300 pixels. Temporary viewport overrides were reset.

[Edited-take preview](../assets/studio-completion-preview.png) and
[phone editor](../assets/studio-completion-mobile.png).

- All 18 matrix exports passed: six presets × portrait/landscape/square, 199.5
  seconds of H.264 video. Completed artifacts survived an interrupted local run;
  the resumed matrix re-probed and checksummed every output. All 18 decoded
  frames were inspected. Evidence is in the ignored local
  `.artifacts/studio-completion/matrix/release-matrix/report.json`.
- The normal editor Export MP4 action also completed through the durable worker
  using the edited take, with an MP4-ready state in the browser. The final
  omitted-scene control opened a separate scene preview without changing the
  edited full-reel output; no browser errors were reported.

- Initial Windows CI passed 1,019 tests but timed out while building two SQLite
  fixtures. Those fixtures now apply the identical migrations in memory and
  copy the complete schema to a real file once, then seed atomically. This uses
  the existing polling-test approach; recovery/locking tests still run on disk,
  with every assertion and deadline unchanged. Replacement platform CI is required.
  The copied and direct schemas matched all 120 schema entries, integrity and
  foreign-key checks passed, and all nine affected tests passed locally.

- Final translation provenance regression coverage preserves complete per-scene
  design/visibility overrides and validated stock attribution/hash snapshots.
  Stock metadata participates in the source hash; a missing required snapshot
  rejects the clone before creating a project.
