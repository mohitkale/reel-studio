# Contributing scenes

How to add a template, motion treatment or provider. General contribution rules
(branches, PRs, checks) are in [CONTRIBUTING.md](../CONTRIBUTING.md) and
[AGENTS.md](../AGENTS.md). HyperFrames is Apache-2.0; GSAP and added assets keep
their own terms (see [licensing](LICENSING.md)).

## Add a template

1. Add an entry in `src/engines/hyperframes/templates.ts`.
2. Implement the HTML, CSS and motion in the composition builder under
   `src/engines/hyperframes/`, or vendor a reviewed registry block by listing it in
   `src/engines/hyperframes/catalog/selection.json` and running
   `npm run sync:hf-catalog`.
3. Register the id in the engine catalog so the editor picker lists it, and give
   it a stable planner-facing `capabilityId` in `src/engines/capabilities.ts`.
   Provider schemas expose the capability id, never the internal template id.
4. Keep templates self-contained (no paid or hotlinked assets) and document props:
   `text`, `spokenText`, `emphasis`, `visual` and layout JSON.
5. Keep element ids unique, put all motion on the single paused HyperFrames
   timeline, and make layouts work at 9:16, 1:1 and 16:9.

Classic ids: `hf-opener`, `hf-statement`, `hf-list`, `hf-stat`, `hf-quote`,
`hf-cta`. Catalog synchronization pins a release tag and upstream revision,
validates types, paths, variables, dependencies and assets, records SHA-256
checksums and never changes an existing version directory. Run it twice before
review: the second run must report no changes.

## Add a scene type

A storyboard scene type is one folder under `src/engines/hyperframes/scenes/<type>/`
whose `index.ts` exports a `SceneDefinition` (`src/engines/hyperframes/scenes/types.ts`):
the payload `schema`, `layout` notes for each format, `build` (the markup inside the
panel) and a `sample`. Registering it is one line in `scenes/registry.ts`.

1. Add the type to `SCENE_TYPES` and any new data field to `src/storyboard/schema.ts`;
   run `npm run storyboard:schema`.
2. Map it in `STORYBOARD_TEMPLATE_BY_TYPE`, `STORYBOARD_ROLE_BY_TYPE` and the `panel`
   switch in `src/production/storyboard-plan.ts`, and in `src/library/project-storyboard.ts`
   for export.
3. Size text from `--frame-h` with the helpers in `scenes/styles.ts`; the engine grows or
   shrinks it to fit the panel. Use `kit.onAccent` for text on the accent colour.
4. Check it: `/scenes` shows it, `npx vitest run src/engines/hyperframes/scenes`, and
   `npm run examples:lint-frames -- --only <example>` passes for a storyboard that uses it.

## Add a theme

One file in `src/video/themes/` plus one line in `src/video/themes/index.ts`. Use only
the bundled fonts (see [licensing](LICENSING.md)). `themes.test.ts` fails when text,
muted text or accent text on the theme's panel drops under the contrast limits, and
`node scripts/theme-sheet.mjs` renders one storyboard in every theme.

## Add an authored motion block

Register data in `src/video/motion-extensions.ts` and a renderer plus styles in
`src/engines/hyperframes/motion/registered-blocks.ts`. Recipe ids, editor options,
validation and timeline landmarks derive from those definitions; a test requires
every declared extension to have a renderer. Declare the block's real copy and
media compatibility rules, and never accept executable HTML, CSS or JavaScript
from project data. Run `npm run test:extensions` for a real export check.

## Add a provider

Local planning providers register in `src/providers/ai/local-definitions.ts`; ids,
Zod schemas, defaults, labels, settings cards and diagnostics derive from that one
definition. An OpenAI-compatible local server needs one registration with a label,
protocol and defaults. Gemini and OpenAI keep fixed-origin cloud transports and
separate credentials. Voice and stock providers live under `src/providers/`.

## Pull request checklist

- [ ] Works in portrait, landscape and square with supplied copy and media
- [ ] No personal or copyrighted media committed; asset licences documented
- [ ] Focused contract tests plus **actual exported frames** and a contact sheet
- [ ] `docs/FEATURES.md` updated if a page, route or tool changed

Details from the earlier docs set: [template authoring](archive/guides/TEMPLATE_AUTHORING.md),
[extensions](archive/guides/EXTENSIONS.md), [Scenes and themes](SCENES_AND_THEMES.md).
