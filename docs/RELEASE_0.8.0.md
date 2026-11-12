# Reel Studio 0.8.0

Release: [v0.8.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.8.0).

This release adds source-linked research and editorial production, scene-relevant
media ranking, supplied product proof and reproducible quality comparisons.
Existing projects, saved exports and provider/dependency pins remain compatible.

## What changes for creators

- Research with optional Gemini/OpenAI tools or supplied text/public articles.
  Inspect frozen excerpts, conflicts and gaps before choosing a separate local or
  cloud writer. Imported evidence stays visibly unverified.
- Review a saved editorial script before local storyboard compilation. Product,
  explainer, news, data and brand briefs have distinct arcs. Writing, research and
  optional copy revisions keep separate explicit call budgets and durable state.
- Make scoped copy or visual revisions with stale-state checks, locks, source
  diffs and grouped undo. REST and MCP share the guarded production contracts.
- Automatic stock choices rank subject/crop/resolution/continuity and retain
  reasons and alternatives. Optional OpenAI vision has a separate one-call budget;
  supplied media takes priority. Provider licensing and attribution still apply.
- Map real screenshots/recordings to features and recurring subjects. Contained
  frames and checked recording cues preserve approved narration and copy. Missing
  proof is flagged; supplied artifacts do not establish customer outcomes.
- Technical identifiers retain underscores during Markdown cleanup. Brand
  closings without a supplied visual no longer invent a default mark.

See [research](RESEARCH.md), [editorial creation](EDITORIAL.md),
[media relevance](MEDIA_RELEVANCE.md) and the [benchmark](EDITORIAL_BENCHMARK.md).
Citations establish provenance, not guaranteed truth. Numeric admission and
review findings are conservative checks; source accuracy still needs review.

## Upgrade from v0.7.0

Node 24 LTS (minimum 24.15), FFmpeg/FFprobe and Chrome remain required. Dependency
pins, the prebuilt speech engine and existing media stay unchanged. Two additive
migrations add research/evidence jobs and separately budgeted media-ranking jobs;
the database now has twenty migrations.

1. Stop the app and background worker.
2. Back up the configured SQLite database and media folder together, including
   remaining WAL/SHM files and `.env.local`.
3. Update to v0.8.0, run `npm ci`, then `npm run setup` to regenerate the Prisma
   client and apply migrations through the backup-aware runner.
4. Run `npm run doctor`, restart the app, and review an existing project/export.

```bash
npm run test:release-upgrade
```

The release evidence also checks a populated published v0.7.0 database, saved
studio/history/audio records, backup restoration and fresh-schema parity. Earlier
versions require their intervening upgrade notes.

To roll back, stop the app/worker, restore the paired database/media backup,
check out the prior release and use its locked install. Do not open an upgraded
database with an older app. Keep the original backup until the upgrade is accepted.

## Optional providers and validation

Existing direct creation remains available. Research, writing, voice and vision
calls are optional and independently budgeted. Select compatible models explicitly;
failed or canceled spent calls are never automatically replayed. New software,
paid calls and model downloads are not part of release acceptance.

The unchanged GPL speech engine's matching complete corresponding-source archive
and notices accompany the release. See [licensing](LICENSING.md) and
[release validation](production/RELEASE_VALIDATION.md). Published `validation.json`
identifies the exact release commit, successful platform gates, review status and
downloadable asset checksums. Offline fixtures do not certify live model quality,
source freshness, narrated pacing or human preference.
