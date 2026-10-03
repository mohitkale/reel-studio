# Runtime, jobs, and recovery

## Launch and storage

- `npm run dev` and `npm run start` supervise Next.js and one production worker.
- Production use builds first with `npm run build`; Docker uses the same supervisor.
- `npm run production:worker` is for explicitly managed deployments, not a second normal worker.
- Projects/revisions/jobs live in SQLite; takes, uploads, caches, and outputs live under `media/`.

Web/worker connections verify WAL mode and a five-second busy timeout. Progress
writes coalesce at 250 ms and flush before completion. Job lists batch fresh
revision reads; saved edits become visible on the next request. Transient
contention is tolerated only within the confirmed lease.

## Durable behavior

- Voice, editor export, podcast, and production work share persisted job state.
- Submission freezes script, brand, caption, take, and eligible media inputs.
- Production revisions add immutable hashes and idempotency above the worker snapshot.
- Reconnects read saved stages/results; editing cannot mutate a submitted output.
- Retries reuse valid stages and checksum-verified artifacts.
- Interrupted/uncertain provider work requires explicit retry, preventing accidental paid replay.
- Queued cancellation is immediate; active cancellation aborts IO and terminates owned renderer trees.
- Legacy MCP tokens keep human video approval; scoped tokens may explicitly allow bounded automation.

The supervisor uses bounded crash backoff (five attempts), resets the worker
crash budget after a minute of healthy uptime, and stops the pair if the web
process fails or recovery is exhausted. Shutdown waits for child cleanup with a
ten-second forced bound. Interrupted local rendering can recover its lease;
audio/provider work needs explicit retry.

## Media and section caches

- Authorized downloads/ranges use backpressure and 64 KiB chunks.
- Checksums stream; frozen assets use content-addressed local files.
- Export stages public media through bounded DNS-pinned requests before Chromium starts.
- Chapter exports use native 30-second visual sections at 24/30/60 FPS.
- Unchanged section inputs reuse verified cached frames; brand/timing/media/renderer changes invalidate them.
- Final audio is mixed continuously and muxed once, then optionally mastered.
- Inactive render caches expire after seven days and trim toward 1 GiB.

See [bounded IO](IO_RECOVERY.md), [advanced editing](ADVANCED_EDITING.md),
[security limits](PORTABILITY_HARDENING.md), and [video migration](VIDEO_ENGINES.md).

## Targeted verification

- `npm run test:production-worker`: isolated real export plus active cancellation.
- `npm run test:video-sections`: short section/retry/review fixture.
- `npm run test:video-sections -- --long --cancel`: 210-second chapter recovery fixture.
- `npm run benchmark:long-videos -- --engine=hyperframes`: optional offline performance experiment.

These use installed rendering tools, generate ignored `.artifacts/` evidence,
and preserve application data. Calibration audio checks integration rather than
live-model speech quality. [Release validation](production/RELEASE_VALIDATION.md)
records the shipped release evidence.
