# Template authoring

Reel Studio supports two template systems. Prefer **HyperFrames** for
Apache-2.0 contributions; use **Remotion** when you need React compositions.

## HyperFrames (`hf-*`)

1. Add a template entry in `src/engines/hyperframes/templates.ts`
2. Implement HTML/CSS/motion in the HyperFrames composition builder
   (`src/engines/hyperframes/`) **or** vendor a registry block under
   the reviewed selection in
   `src/engines/hyperframes/catalog/selection.json`, then run
   `npm run sync:hf-catalog`
3. Register the id in the engine catalog so the editor picker lists it
4. Keep templates self-contained (no Unsplash or paid assets required)
5. Document props: `text`, `spokenText`, `emphasis`, `visual`, layout JSON

Classic ids: `hf-opener`, `hf-statement`, `hf-list`, `hf-stat`, `hf-quote`, `hf-cta`

Curated upstream catalog ids (wired via `data-composition-src`):
`hf-kinetic-slam`, `hf-money-count`, `hf-data-chart`, `hf-app-showcase`,
`hf-logo-outro`, `hf-ig-follow`, `hf-tt-follow`, `hf-yt-lower-third`

The reviewed catalog snapshot is selected in
`src/engines/hyperframes/catalog/selection.json` and synchronized with
`npm run sync:hf-catalog`. The selection pins a stable package pair, release tag,
and immutable upstream Git revision. Synchronization validates registry item
types, paths, metadata, variables, dependencies, declared assets, and offline
render requirements; records SHA-256 checksums; emits typed capabilities and an
unsupported-item report; and refuses to change an existing version directory.
Run it twice before review: the second run must report only unchanged files.
Retain every earlier directory for projects that reference its revision.

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
