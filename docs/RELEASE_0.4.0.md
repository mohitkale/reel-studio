# Reel Studio 0.4.0

Stable release: [v0.4.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0).

The release combines prompt-first creation/results/remix, a responsive editor,
six presets, sixteen authored motion treatments, source-grounded direction and
HyperFrames-only production. Voice, render and podcast work use durable jobs.
Local AI supports Ollama, LM Studio and llama.cpp; all remain optional. Paid
providers require configured credentials and explicit budgets.

## Upgrade from published v0.3.0

1. Stop the app and its production worker. Back up the SQLite file, the complete
   `media/` directory and your private `.env.local` separately.
2. Use Node 24 LTS (minimum 24.15), the locked dependencies via `npm ci`, and your
   existing FFmpeg/FFprobe and Chromium installation.
3. Run `npm run db:migrate`. Recognized v0.3.0 databases receive a consistent
   adjacent `.backup-…` snapshot before the 14 versioned migrations. Unknown
   schemas fail without changing user data; reconcile drift before retrying.
4. Run `npm run build`, then `npm run start`. Fresh installations use
   `npm run setup` to seed the local examples without cloud credentials.
5. Open saved projects and verify media/takes before submitting new exports.
   Remotion engine/template values migrate to HyperFrames. Copy, media, original
   audio and historical MP4 files remain intact; future renders may look different.

Rollback with the app stopped: restore the matching pre-upgrade database and
application version together, retaining the media directory. Database backups
alone do not include media. v0.3.0 has no caption-track table; legacy caption
payloads remain preserved, and new caption tracks survive later migration reruns.

The frozen fixture was generated from the schema at the actual published
[v0.3.0 tag](https://github.com/mohitkale/reel-studio/releases/tag/v0.3.0),
commit `3bd458296a0e5ad367f6c1122b064fddf6ff9c2f`. Only the obsolete datasource
URL syntax was removed for the installed Prisma generator. Its provenance and
schema checksum are recorded in `tests/fixtures/release-v030/provenance.json`.
Run `node scripts/verify-release-upgrade.mjs` for isolated setup/upgrade evidence.

## Licenses and supported boundaries

Application code is MIT; HyperFrames is Apache-2.0. The replacement phonemizer's GPL-3.0-or-later
eSpeak engine has pinned source/build provenance and accompanying notices. Its
complete corresponding-source archive is provided as a separate release asset. GSAP, fonts, optional models/providers and
media retain their separate terms. See [LICENSING.md](LICENSING.md).

The app targets a trusted single-user local account. Chromium rendering uses
`--no-sandbox`; remote multi-user hosting requires additional session/auth and
host/network controls. Unsplash export staging and Coverr remain gated by their
provider terms. Optional Kokoro model downloads and paid calls are not part of
credential-free fixture verification. A protocol/audio calibration fixture proves
workflow integration, not the acoustic quality of a live voice model.

## Verification

[Current release validation](production/RELEASE_VALIDATION.md) records dated
checks, checksummed real exports, browser workflows, upgrade preservation and
platform CI. Historical September matrices remain explicitly historical.
The release targets the exact merged and refreshed `main` commit. The GitHub
release records the tag target and asset checksums.
