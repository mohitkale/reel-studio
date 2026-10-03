# Bounded IO and process recovery

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
uploads have separate owners and are separately bounded in [hardening](PORTABILITY_HARDENING.md).

The supervisor, render/audiogram workers, visual review and local transcription
share owned-process cleanup. POSIX uses an owned process group, a pre-termination
descendant snapshot (including detached browser processes), and a bounded
SIGTERM-to-SIGKILL grace period. Windows runs `taskkill /PID <owned-pid> /T /F`
before the leader exits: console workers are stopped forcefully together with
their descendants. It does not kill by image name or invoke a shell. Worker
callers wait for cleanup before releasing scratch files; supervisor completion
also waits for its cleanup operations. Errors are reported. Interrupted jobs reconcile against durable state; the supervisor resets its
worker crash budget after healthy uptime. See [runtime/recovery](RUNTIME.md).

Request-boundary Zod validation is explicitly marked with `parseClientInput()`
and returns 400 with issue details. `readRequestJson()` also maps malformed JSON
to 400, permitting truly empty bodies only where defaults already exist.
Unmarked downstream/provider-output Zod failures retain 502; provider errors
retain their own status. Catalog adapter availability uses an ordered list of
known revisions. Append new revisions to that list; commit-hash spelling does
not establish chronology and unknown revisions cannot unlock gated adapters.

## Targeted verification

```bash
node --expose-gc --import tsx scripts/verify-bounded-io.ts
node scripts/verify-process-tree.mjs
npm run test:production-worker
```

These cover large-file backpressure, range/abort/containment, process cleanup,
real export, and active cancellation. Process cleanup runs on Linux and Windows
in CI. Reports stay in `.artifacts/`; [release validation](production/RELEASE_VALIDATION.md)
records shipped acceptance rather than historical test counts.
