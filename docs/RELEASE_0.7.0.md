# Reel Studio 0.7.0

Release: [v0.7.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.7.0).

This release completes the creator studio for podcasts, voiceovers and motion
videos, with responsive workspaces and saved editing/review workflows.

## What changes for creators

- A creation hub connects automatic, assisted and manual workflows. Dedicated
  voiceover tools add paragraph editing, shared speech presets, pronunciation
  previews, take comparison and approval-gated batches.
- Waveform edits save across reloads with undo/redo, guarded revisions and new
  edited takes for video or podcast export. Original audio remains unchanged.
- Record or import podcast audio, optionally transcribe it with local Whisper,
  review words and speaker labels, and download an episode package.
- Create reviewed language versions as separate projects, manually or with an
  optional configured AI provider. Design overrides, series and validated stock
  attribution survive; narration and captions must be regenerated or reviewed.
- Persistent scene/script history supports creation, deletion, ordering and
  grouped AI edits. Asset deletion checks saved history and frozen production.
- Editable chart grids, text entrance controls, safe zones and preview selection
  complement mobile editor tabs and project search, series and archive filters.

See the [creator guide](CREATOR_GUIDE.md) and [factory workflows](FACTORY_WORKFLOWS.md).
Whisper does not identify speakers automatically. Review partially cut transcript
passages, caption timing and text embedded in visual assets before delivery.

## Upgrade from v0.6.0

Node 24 LTS (minimum 24.15), FFmpeg/FFprobe and Chrome remain required. Dependency
pins and the prebuilt local speech engine are unchanged. Three additive migrations
add studio organisation, shared presets and saved audio editing sessions.

1. Stop the app and background worker.
2. Back up the configured SQLite database and media folder together. Include
   remaining WAL/SHM files and retain `.env.local`.
3. Update the checkout to v0.7.0, run `npm ci`, then `npm run setup` to apply
   the migrations with the backup-aware runner.
4. Run `npm run doctor`, start the app, and review an existing project/export.

Local Whisper is optional: configure an existing model with `WHISPER_CPP_MODEL`.
The app does not automatically download models. Release validation reused cached
Kokoro and one explicitly approved multilingual Whisper small model; no paid
provider calls were made. Paid-provider live tests were excluded by request.

```bash
npm run test:release-upgrade
```

The isolated check covers populated published v0.3.0/v0.4.0 upgrades through all
eighteen migrations, preserved copy/media/takes/exports/captions, backup restoration
and fresh setup. A direct published v0.6.0 schema upgrade also preserves populated
factory profiles, packs, runs and variants, with runner backup/restore and fresh
schema parity. Earlier releases also need their intervening upgrade notes.

To roll back, stop the app/worker, restore the paired database/media backup,
check out the previous release and use its locked install. Do not open the
upgraded database with an older app; retain the original backup.

## Components and verification

The unchanged GPL speech engine's matching complete corresponding-source archive
and notices accompany this release. No compiler or model download is needed for
silent video. See [licensing](LICENSING.md) and
[release validation](production/RELEASE_VALIDATION.md) for exported frames,
recovery, browser and upgrade checks. Published `validation.json` records the
exact release commit, platform CI and downloadable asset checksums.
