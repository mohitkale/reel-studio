# Reel Studio 0.5.0

Release: [v0.5.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.5.0).

This release makes AI-first creation easier and adds content-directed motion:
23 authored treatments, nine developing story showpieces, coherent palettes and
motion families, plus event-timed sound. The editor and export share saved
direction, narration context and sound timing.

## What changes for creators

- Projects leads with **Create with AI** and **Create production**. Optional
  customization follows the content; blank projects remain available.
- Automatic AI colours follow the topic. Select a kit under **Customize style
  and media → Colour palette** to use brand colours. Existing projects retain
  their saved brand and direction.
- Concepts, comparisons, processes, organisations, systems and product stages
  can become developing vector scenes. Lunar and seasonal content can use
  phase cycles, an almanac wheel and orbital rhythms. These are qualitative
  illustrations, not calculated dates or astronomical forecasts.
- Full-reel preview, visual direction, visual review and export status are
  easier to reach. Scene locks, supplied data/media and production revisions
  remain authoritative.
- Gemini's nested JSON Schema request is fixed, and development workers reload
  renderer changes alongside previews.

See the [creator guide](CREATOR_GUIDE.md) and [motion library](MOTION_LIBRARY.md)
for compatible inputs and editable controls. Automatic direction selects from
a curated vocabulary; review AI-generated claims and narration before publishing.

## Upgrade from v0.4.0

Node 24 LTS (minimum 24.15) and FFmpeg/FFprobe remain required. No dependency
upgrade or database migration is introduced by this release.

1. Stop the app and background worker.
2. Back up the configured SQLite database and its media folder together.
   If WAL/SHM files remain, include them with the database. Keep `.env.local`.
3. Update the checkout to v0.5.0, run `npm ci`, then `npm run setup`.
4. Run `npm run doctor`, start the app, and review a saved project/export.

The isolated upgrade check covers the actual published v0.3.0 baseline and a
populated v0.4.0 database. The v0.4.0 schema and all fourteen migration hashes
are pinned to that tag; saved copy, assets, takes, exports and caption rows are
checked after upgrade and backup restoration. Run:

```bash
npm run test:release-upgrade
```

For v0.3.0, also read the [v0.4.0 migration notes](RELEASE_0.4.0.md). To roll
back, stop the app/worker, restore the paired database/media backup, check out
the previous release and run its locked install. New v0.5.0-only directions
are not promised to render in an older application.

## Components and verification

The prebuilt speech engine is unchanged. Its matching complete corresponding
source archive and notices accompany this release; no compiler or voice-model
download is needed for the first silent video. See [licensing](LICENSING.md).

[Release validation](production/RELEASE_VALIDATION.md) records actual renders,
upgrade/rollback, browser and cancellation checks, component hashes and platform
CI. Historical measurements retain their original release labels.
