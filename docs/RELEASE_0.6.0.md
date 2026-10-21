# Reel Studio 0.6.0

Release: [v0.6.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.6.0).

This release brings the adaptive content factory together: content-aware recipes,
film-wide direction, review controls, bounded lessons and reusable series delivery.
M1–M6 shipped through PRs #48–53. M0 was completed retrospectively against actual
v0.5.0 source, with twelve paired films and 96 decoded scene frames.

## What changes for creators

- Six adaptive recipes resolve supplied meaning, copy density, timing and canvas.
  Saved subject identities and sequence decisions keep returning ideas consistent.
- Film-plan checkpoints, contact sheets and draft animatics support review before
  final export. Scoped variations have persistent guarded undo.
- Explicit lesson production adds chapter goals, examples and recap callbacks up
  to ten minutes. Normal video stays capped at three minutes; ordinary chaptered
  video at five. Storyboards stay bounded at 240 scenes.
- Versioned series profiles supply reusable defaults. Factory batches produce
  aspect variants and whole-scene cutdowns with frozen inputs, parent lineage,
  explicit cancellation/resume and pinned bundled data/asset packs.
- Data Story chart fallback now keeps supplied background images with source text,
  chart values and attribution across all three canvases.

See [adaptive contracts](ADAPTIVE_CONTRACTS.md),
[factory workflows](FACTORY_WORKFLOWS.md), and the
[baseline comparisons and rubric](production/ADAPTIVE_BASELINE.md).
Automatic visuals use a bounded authored vocabulary. Human blind-preference and
repair-free targets remain unmeasured. Hindi visual samples use host font
fallback; portable Devanagari coverage and Hindi speech quality are not certified.

## Upgrade from v0.5.0

Node 24 LTS (minimum 24.15), FFmpeg/FFprobe and Chrome remain required. Dependency
pins and the local speech engine are unchanged. One additive migration creates
factory profiles, runs, variants and packs; it does not replace existing projects.

1. Stop the app and background worker.
2. Back up the configured SQLite database and media folder together. Include
   remaining WAL/SHM files and retain `.env.local`.
3. Update the checkout to v0.6.0, run `npm ci`, then `npm run setup` to apply the
   additive migration.
4. Run `npm run doctor`, start the app, and review an existing project/export.

The isolated upgrade check exercises published v0.3.0 and v0.4.0 schemas, the
fourteen frozen historical migrations, populated copy/media/takes/exports/captions,
backup restoration and fresh setup. v0.5.0 has the identical schema and migration
bytes as v0.4.0; its equivalence is recorded in release acceptance evidence.

```bash
npm run test:release-upgrade
```

For v0.3.0, also read the [v0.4.0 migration notes](RELEASE_0.4.0.md). To roll back,
stop the app/worker, restore the paired database/media backup, check out the
previous release and use its locked install. New factory tables and adaptive
plan metadata are not promised to work in an older app; retain the backup.

## Components and verification

The unchanged prebuilt speech engine's matching complete corresponding-source
archive and notices accompany this release. No compiler or model download is
needed for silent video. See [licensing](LICENSING.md) and
[release validation](production/RELEASE_VALIDATION.md) for actual exports,
upgrade/rollback, recovery, browser checks and platform CI. Published validation
records the exact release commit and downloadable asset checksums.
