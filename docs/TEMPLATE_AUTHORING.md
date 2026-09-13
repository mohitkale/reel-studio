# Template authoring

Reel Studio supports two template systems. Prefer **HyperFrames** for
Apache-2.0 contributions; use **Remotion** when you need React compositions.

## HyperFrames (`hf-*`)

1. Add a template entry in `src/engines/hyperframes/templates.ts`
2. Implement HTML/CSS/motion in the HyperFrames composition builder
   (`src/engines/hyperframes/`) **or** vendor a registry block under
   `src/engines/hyperframes/catalog/blocks/` and register it in
   `catalog/manifest.ts`, then run `node scripts/embed-hf-catalog.mjs`
3. Register the id in the engine catalog so the editor picker lists it
4. Keep templates self-contained (no Unsplash or paid assets required)
5. Document props: `text`, `spokenText`, `emphasis`, `visual`, layout JSON

Classic ids: `hf-opener`, `hf-statement`, `hf-list`, `hf-stat`, `hf-quote`, `hf-cta`

Curated upstream catalog ids (wired via `data-composition-src`):
`hf-kinetic-slam`, `hf-money-count`, `hf-data-chart`, `hf-app-showcase`,
`hf-logo-outro`, `hf-ig-follow`, `hf-tt-follow`, `hf-yt-lower-third`

The premium catalog snapshot is selected in
`src/engines/hyperframes/catalog/selection.json` and imported with
`npm run import:hf-catalog`. The selection pins a full upstream Git revision.
The importer validates registry item types, paths and metadata, stores blocks and
components separately, downloads declared assets and records SHA-256 checksums.
Never change an imported revision in place; add a version and retain the earlier
directory for projects that reference it.

## Remotion

1. Add metadata in `src/compositions/templates.ts`
2. Add the React component and register it in `src/compositions/registry.tsx`
3. Follow existing brand-token and caption patterns
4. Remotion is **not** OSI open-source — note licence impact in PR descriptions

Existing ids: `kinetic`, `lottie`, `three`, `stat-reveal`, `icon-grid`, `quote-card`, `emoji-punch`

## Checklist for PRs

- [ ] Works in portrait (and ideally landscape / square)
- [ ] No personal or copyrighted media committed
- [ ] Preview and draft render look readable
- [ ] Asset licences documented if any files are added
- [ ] Tests or a minimal smoke path when practical

See also [docs/VIDEO_ENGINES.md](VIDEO_ENGINES.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
