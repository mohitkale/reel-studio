# Portability and hardening — M8

Reviewed 2026-10-02 against the M2-upgraded lockfile. This is a single-user,
local-first application; these boundaries do not create a hostile-code sandbox.

## Platform and CI gates

Quality runs the full typecheck, lint, unit suite, scanner, release check and
production build on Ubuntu and Windows. FFmpeg/ffprobe are installed on ephemeral
CI runners; local software and models are unchanged. Process-tree cancellation
has its own two-platform gate. Action v4 references are pinned to their resolved
commit SHAs, checkout does not retain credentials, and workflows grant only
`contents: read`.

Text, including vendored catalog HTML/JS, checks out as LF. Binary assets remain
binary. Transcription fixtures execute Node explicitly with `shell: false`,
rather than depending on a POSIX shebang/executable bit. Owner-only mode checks
apply on POSIX; Windows secrets rely on inherited account/directory ACLs.
The 8 GiB read fixture marks its NTFS file sparse before extending it, retaining
the large-file/backpressure assertion without allocating eight gigabytes.

## Request and render media boundaries

Request helpers count bytes from the actual stream, regardless of a missing,
false or oversized Content-Length. They cancel oversized/stalled bodies and
cover body reads with a 30-second deadline. Limits are aggregate request limits:

| Route family                         | Limit                                         |
| ------------------------------------ | --------------------------------------------- |
| Ordinary JSON APIs                   | 4 MiB                                         |
| Browser voice clip/take JSON uploads | 96 MiB (existing per-item limits still apply) |
| Asset multipart                      | 25 MiB file + 512 KiB envelope                |
| VoiceForge reference multipart       | 64 MiB                                        |

Bounded multipart parsing still uses memory; these are per-request bounds, not
a global concurrency/memory quota. Large browser audio JSON retains base64
encoding overhead. Assets reject SVG and mismatched binary media signatures;
Lottie uses the existing expression-free player.

Remote export assets are downloaded before Chromium starts: HTTP(S) only,
standard web ports, no credentials, public literal addresses and exclusively
public DNS answers. The socket's custom lookup returns exactly the checked
answers. Every redirect is checked again, including rebinding, mixed DNS,
IPv4-mapped IPv6, transition/special address forms and metadata aliases. Downloads
have a 60-second total deadline, a 250 MiB actual-byte cap per asset, identity
encoding and an image/audio/video MIME allowlist. Text/HTML/SVG and disguised
playlists fail signature checks before native probing; partial files are removed.
This is a signature guard, not complete container/decoder validation or a total
render disk quota. Protect disk space and do not ingest hostile media.

Production jobs freeze eligible remote and local media under checksum-addressed
`media/production-assets/` files and repair altered cache entries. Exports copy
media into their isolated project. Local origins must match scheme/host/port;
real-path containment rejects external symlink escapes. Unsplash hotlinks remain
preview-only: their API terms have no established staging exception, so exports
fail with an actionable license-gate error rather than silently copying them.
Browser previews can still fetch public URLs directly; server DNS pinning does
not apply to those browser requests.

Response headers restrict framing with `frame-ancestors 'self'` and
`X-Frame-Options: SAMEORIGIN`, disable objects, constrain the base URI, and add
nosniff/referrer policy. Same-origin HyperFrames srcDoc previews, inline timelines
and browser TTS remain usable. This targeted policy does not claim script/XSS
isolation. HyperFrames Chromium still uses `--no-sandbox`; local code and native
media decoders share the account's trust boundary.

Development Compose mounts source writable for hot reload. Named volumes separate
Linux dependencies/database/media, but container code can modify host source and
consume host CPU/memory. Strict bearer mode has no browser login/session and
cannot enable remote web-only settings/approvals. Remote browser hosting requires
an explicit session/auth integration as well as allowed Host, TLS and firewall.

## Dependency reachability snapshot

`npm audit --json` and `npm audit --omit=dev --json` both report **7 high package
findings**; parent-package propagation is included in that count. The underlying
advisories remain present, not waived by tests. Offline
`npm run security:inventory` records every lockfile location/version/declared
license plus the lockfile SHA-256, including nested duplicates.

| Installed component                    | Advisory / verified application path                                                                                                                                                                                                                           | Decision                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Nested Sharp 0.34.5 under Transformers | [GIF/TIFF/VIPS decode](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [libheif decode](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). Kokoro uses text/token/audio inference; its application path does not invoke Transformers RawImage.            | No compatible nested patch is offered. Reassess if Transformers image input is added.                 |
| Root Sharp 0.35.5                      | Next image optimization and visual-review PNG decoding resolve this patched copy.                                                                                                                                                                              | Already above both patch versions; do not confuse it with the nested copy.                            |
| deepmerge-ts 7.1.5 via @prisma/config  | [Recursive JS graph denial of service](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Prisma loads maintained local configuration; API JSON is not supplied as a recursive configuration object.                                                          | Patched version 8 requires upstream compatibility work; no blind major override.                      |
| mysql2 3.15.3 pinned by Prisma 7.10.0  | [Compressed-protocol expansion](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), [authentication downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr). Application databases use file URLs and the better-sqlite3 adapter, not a MySQL connection. | Prisma pins the affected version; do not force an override or the audit's suggested Prisma downgrade. |

These reachability statements describe the current supported workflow, not proof
that the packages can never be exploited. Installing another provider/database or
using Prisma Studio against MySQL changes the assessment. No compatible targeted
patch was identified for the remaining findings; the lockfile is unchanged.

## License inventory and verification scope

[LICENSING.md](LICENSING.md) records confirmed package terms and embedded eSpeak
NG, GSAP and optional XTTS distinctions. Declared metadata is insufficient for
embedded WASM/native libraries. M15 must verify corresponding source/build
provenance and distribution notices before publishing bundles/images. This work
does not claim the whole stack is Apache-2.0 or wholly OSI open source.

Tests cover stream byte accounting/deadlines/cancellation, real staged-index
secret scanning and redaction, public-address and DNS socket/redirect policies,
hotlink gates, signature mismatch and local real-path escapes. Full platform CI
and native export/cancellation checks are the merge gate. Acoustic Kokoro model
quality, remote session authentication and a hostile-code Chromium sandbox are
outside these tests.

Inventory evidence: lockfile SHA-256
`68c9b15c7ed969287a9b4c0cc9584b3295ba4d309e92aa2e29c1eec5de802c17`,
1,058 package locations. Seven omit a lockfile license field: six HyperFrames
workspace packages (upstream Apache-2.0 repository license) and seq-queue 0.0.5
(installed LICENSE is MIT). Embedded-component review remains necessary even
when metadata declares a permissive license.

Local acceptance: 798 tests in 154 files, typecheck, lint, release checks and
production build passed. An isolated real HyperFrames export and active
cancellation passed (`.artifacts/production-worker-1790956301518`). Chrome 153
initialized and sought the actual HyperFrames srcDoc composition under production
headers and verified cross-origin framing was blocked (`.artifacts/m8-hardening`).

The first Windows run passed 790 tests and exposed eight failures. Fixes retain
assertions rather than disabling them: platform-native paths, NTFS replacement
being blocked while a read handle is open, and supervisor child PIDs being gone
rather than expecting Windows force-kill to execute POSIX signal handlers. The
24-scene SQLite restoration test has a scoped 20-second integration timeout.
Its 49 focused tests pass locally; replacement latest-head platform CI remains
the merge gate. CI skips optional CUDA libraries for the CPU-only Kokoro path.

## M15 advisory refresh (2026-10-03)

A fresh locked install reports 12 high package findings in the full audit and
7 high in `npm audit --omit=dev`; no critical findings are reported. Parent
propagation is included. The seven runtime findings and their reachability are
unchanged from the table above. An additional five development findings propagate
from braces 3.0.3 through micromatch → fast-glob → Next's ESLint plugin/config.
The [current upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
reports stack exhaustion from deeply nested glob patterns and no patched version.
The installed plugin reads maintained local ESLint root-directory globs; HTTP
content and uploaded project/media inputs are not passed to that lint path.
Do not apply npm's proposed Next 14 or Prisma 6 downgrade to silence the audit.
The findings remain documented and must be reassessed if these paths change.

M15 replaces the opaque phonemizer engine with the source-built GPL-3.0-or-later
component in `vendor/phonemizer`; exact compiler/source/output hashes, complete
notices and corresponding-source provision are documented in [LICENSING.md](LICENSING.md).
The original wrapper metadata is historical and does not describe the installed
replacement. This changes no model-weight license and installs no local compiler.
