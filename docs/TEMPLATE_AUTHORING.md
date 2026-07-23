# Template authoring

Reel Studio supports two template systems. Prefer **HyperFrames** for
Apache-2.0 contributions; use **Remotion** when you need React compositions.

## HyperFrames (`hf-*`)

1. Add a template entry in `src/engines/hyperframes/templates.ts`
2. Implement HTML/CSS/motion in the HyperFrames composition builder
   (`src/engines/hyperframes/`)
3. Register the id in the engine catalog so the editor picker lists it
4. Keep templates self-contained (no Unsplash or paid assets required)
5. Document props: `text`, `spokenText`, `emphasis`, `visual`, layout JSON

Existing ids: `hf-opener`, `hf-statement`, `hf-list`, `hf-stat`, `hf-quote`, `hf-cta`

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
