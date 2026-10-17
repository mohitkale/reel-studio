# M6 factory workflow validation

Acceptance date: 2026-10-17. This is functional, compatibility and recovery
validation using existing adaptive graphics and silent timing fixtures. It does
not certify model-written stories, speech quality, or the unexecuted M0 visual
baseline. No dependencies, models, paid calls or external rendering were added.

## Active-app examples and actual exports

`node --import tsx scripts/verify-adaptive-factory.ts` saves **M6 · Factory workflow**,
its six-scene master, an 18-second timing take, immutable master/child revisions,
series profile versions, a durable factory batch and verified MP4s in the active
app database. It also restores **M6 · Editable cutdown** with its own six-second
audio copy and historical lineage. Rerunning the script reopens the recorded run
and retains completed work. Local `.artifacts/adaptive-m6/verified.json` records
IDs, job state, output metadata and checksums.

| Output                   | Canvas    | Duration | Frames at 30 FPS | MP4 bytes |
| ------------------------ | --------- | -------- | ---------------- | --------- |
| Full landscape story     | 1920×1080 | 18 s     | 540              | 2,541,518 |
| Full portrait story      | 1080×1920 | 18 s     | 540              | 2,575,075 |
| Full square story        | 1080×1080 | 18 s     | 540              | 1,644,963 |
| Selected process cutdown | 1080×1920 | 6 s      | 180              | 746,138   |

FFprobe confirmed these durations, frame rates and frame counts. The cutdown
selects source scenes 1 and 4 in that order. Opening and returning-diagram frames
were inspected: the same Capture / Review / Publish labels remain readable, with
landscape using a route and portrait/square using a vertical arrangement.

[Landscape](../assets/adaptive-m6/landscape.jpg),
[portrait](../assets/adaptive-m6/portrait.jpg),
[square](../assets/adaptive-m6/square.jpg),
[cutdown opening](../assets/adaptive-m6/cutdown.jpg), and
[cutdown return](../assets/adaptive-m6/cutdown-return.jpg).

After the first actual export completed, cancellation stopped the remaining three
queued variants. Disconnect/reconnect and explicit resume retained the successful
job/output and completed the remaining variants. No completed job was replayed.
Publishing profile v2 with different delivery defaults left all child snapshot
bytes unchanged. Both output and pack archives were generated successfully.

Adaptive Core `1.0.0` includes seven manifests, 87 asset/notice files (1,260,457
bytes), and eight license/notice records. The compressed archive is 1,200,361
bytes. Its manifest digest is
`sha256:6a3b98088f086b30c5cd1fbbb2aca8462c61049b1a039d9933c2f0550d1abe2f`;
the archive file SHA-256 is
`fee0714e6a36501feae8e43e73347bc9312d2dd2ce42ee5d9ecf610ebafaaac1`.
Archives contain data/manifests and local runtime/fonts; recipe implementations
remain part of the compatible installed application.

Reference machine: macOS x64, Intel i7-9750H, 16 GiB RAM; Node 24.18.1,
producer 0.8.111 and HyperFrames CLI 0.8.110. The renderer used screenshot capture
with four workers. This is not a speed or peak-memory benchmark. The installed
CLI does not expose `usage`, so provider usage is unknown; all fixtures stayed
local and invoked no providers.

## Persistence, authorization and compatibility

Real SQLite integration checks cover immutable profile versions, pack integrity,
explicit cutdown scene order, exact PCM sample selection, rebased take words and
captions, reconnect, partial-submission repair, idempotency conflicts, scoped
batch allowances, and retaining completed work during cancel/resume. A missing
job is repaired from its saved child revision after the editable master changes.
A corrupted pack asset is rejected. Reviewed retries retain approval policy.

Factory restoration remaps scene/take references, copies narration independently,
preserves captions and historical lineage, and retains frozen brand/canvas values.
Choosing another brand kit releases the restored token override. Missing source
audio fails without creating an incomplete project. Compact factory polling reads
progress/download metadata rather than large persisted stage snapshots. Derived
factory revisions are not falsely compared with the mutable parent for staleness.

REST tests cover strict contracts, queue wakeups, cancellation scopes and
studio-only approval. MCP tests verify forwarding through the same endpoints.
The UI regression verifies that retrying after a lost response retains the same
run key and defaults to review before rendering.

Browser verification selected the original master and profile v2, confirmed its
square-only delivery defaults, then created a reviewed run. Cancel → resume
returned to awaiting approval; studio approval completed another 18-second square
MP4. **Edit copy** opened the completed cutdown with two scenes and its independent
six-second take. Forward/reverse seeking showed the correct source scenes, and
**Freeze current film as master** saved a new immutable revision from that copy.
The preview at 4.5 seconds retained the exported returning process labels.
See the [completed factory runs](../assets/adaptive-m6/factory.png) and
[editable cutdown timeline](../assets/adaptive-m6/editor-cutdown.png).

The broader local suite passed **200 files / 982 tests**. Affected tests were rerun
after the final polling refinements. TypeScript, ESLint, secret scanning and the
release metadata/offline composition checks passed. Platform CI and merge gates
are recorded on the milestone PR.

## Database upgrade and release assessment

The migration adds four factory tables and leaves existing tables/rows intact.
The active database was consistently backed up before migration; retry after
closing the verification server resolved a SQLite lock. Published v0.3.0 and
v0.4.0 populated upgrades, backup/restore, media/copy/take/export/caption preservation
and isolated fresh setup passed with 15 migrations.

The v0.4.0 schema fixture was recovered from published commit `2081ac3` and its
SHA-256 matches the existing provenance record. The upgrade verifier reconstructs
the exact prior schema in an owned temporary database, checks it against the
unchanged historical migrations, then exercises the additive factory migration.
Published provenance and old migration bytes remain unchanged.

M1–M6 are a coherent feature set for a future minor release. Publication still
requires a fresh full release-render matrix and exact-release-commit gates; these
factory exports do not substitute for that matrix. M0 remains unexecuted. Current
limits, data/asset pack boundaries and retention behavior are documented in the
[factory guide](../FACTORY_WORKFLOWS.md).
