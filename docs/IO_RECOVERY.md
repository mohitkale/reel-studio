# Bounded IO and process recovery (M4)

Media GETs open an authorized, regular file beneath the real storage root and
read through that same file descriptor. Full downloads and single-byte ranges
use backpressure with at most one 64 KiB read in flight. Open-ended and suffix
ranges are supported; invalid, unsafe-integer, empty and multipart ranges return
416 without reading a body. HEAD reports the full size without reading bytes.
Request abort, response-body cancellation, EOF and read errors close the handle.
SVG remains downloadable bytes with `nosniff`; authorization and private,
non-cacheable responses remain in place. `AssetStore.get()` is intentionally
still buffered for consumers that need complete audio/image bytes; browser
media serving uses `open()` instead.

Path traversal, outside-root file/directory symlinks and non-regular files are
rejected before streaming. Size and stream refer to one open file so an atomic
path replacement cannot substitute a different body. A truncated file fails
the body rather than silently claiming a complete download. This is filesystem
containment, not isolation from another process already able to edit local files.

MP4/take verification, production-media cache validation and render cache
checksums stream SHA-256 with cancellation. Frozen media is copied to an
exclusive temporary file and hashed there before atomic cache publication. This
preserves a consistent snapshot even if its original path changes; corrupted
cache files are replaced. Buffer-based WAV parsing, provider downloads and
uploads have separate owners and are outside this milestone.

The supervisor, render/audiogram workers, visual review and local transcription
share owned-process cleanup. POSIX uses an owned process group, a pre-termination
descendant snapshot (including detached browser processes), and a bounded
SIGTERM-to-SIGKILL grace period. Windows runs `taskkill /PID <owned-pid> /T /F`
before the leader exits: console workers are stopped forcefully together with
their descendants. It does not kill by image name or invoke a shell. Worker
callers wait for cleanup before releasing scratch files; supervisor completion
also waits for its cleanup operations. Errors are reported. Interrupted durable
job reconciliation and supervisor crash-budget reset remain M5.

Request-boundary Zod validation is explicitly marked with `parseClientInput()`
and returns 400 with issue details. `readRequestJson()` also maps malformed JSON
to 400, permitting truly empty bodies only where defaults already exist.
Unmarked downstream/provider-output Zod failures retain 502; provider errors
retain their own status. Catalog adapter availability uses an ordered list of
known revisions. Append new revisions to that list; commit-hash spelling does
not establish chronology and unknown revisions cannot unlock gated adapters.

## Acceptance evidence and reproduction

Verified locally on macOS on 2026-10-02:

- Typecheck, lint, 678 unit/integration tests, secret scan, release checks and
  production build passed.
- Range/HEAD/missing/empty/SVG/abort and storage-containment tests; an 8 GiB sparse
  fixture returns only its four-byte tail without a full-file allocation.
- A 512 MiB complete download and SHA-256 probe used 64 KiB maximum chunks with
  77,819,904 bytes (about 74 MiB) of observed peak RSS growth. The probe fails
  above 128 MiB growth; this is a local measurement, not a universal RSS promise.
- Real Node subprocess probes terminate stubborn and early-exiting leaders plus
  detached descendants; supervisor shutdown waits for both owned trees.
- Existing production-media tests verify cache-corruption repair and original
  media preservation. API tests distinguish invalid requests from downstream
  validation failures.
- The real 32-second portrait HyperFrames section export/retry/review gate passed
  with its original narration/music/SFX mix and reuse of both committed sections.
  Exported scene/cut keyframes and encoded audio checks are recorded under
  `.artifacts/review-m4/sections`; fixture sound is a calibration signal.
- A loopback HTTP probe against the production build verified an 8 GiB sparse
  file's suffix range and HEAD size, multipart-range rejection, client body
  cancellation, invalid project input returning 400, and a downloaded fixture
  MP4 matching the export checksum.

Commands:

```sh
npm run typecheck
npm run lint
npm run test:unit -- --maxWorkers=2
node --expose-gc --import tsx scripts/verify-bounded-io.ts
node scripts/verify-process-tree.mjs
npm run security:scan
npm run release:check
npm run build
```

The Quality workflow runs the Node-only process probe on both Ubuntu and
Windows; both jobs must pass on the final PR commit before merge. The wider
Windows application suite remains M8. Local sandbox execution may need normal
process-table access for the POSIX `ps` descendant snapshot.

Render regression uses an exclusively created directory and an isolated database:

```sh
mkdir -p .artifacts/review-m4
npm run test:video-sections -- --engine=hyperframes --evidence=.artifacts/review-m4/sections
```

Use a fresh evidence directory on reruns. The fixture uses bundled local media
and a labeled audio calibration signal, with no paid providers or new models.
