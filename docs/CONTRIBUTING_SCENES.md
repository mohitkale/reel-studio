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
4. Give it three arrangements. Arrangement 1 is the classic design; add rules for
   `.scene[data-arrange="2"]` and `[data-arrange="3"]` to
   `scenes/arrangements.ts` (alignment, order, spacing, borders and fills; no
   transforms, the entrance animations own those). Look at all three with
   `REEL_FORCE_ARRANGE=2 npm run scenes:sheet` and `=3`.
5. Check it: `/scenes` shows it, `npx vitest run src/engines/hyperframes/scenes`, and
   `npm run examples:lint-frames -- --only <example>` passes for a storyboard that uses it.

## Add a theme (15 minutes)

1. `npm run theme:new ocean-blue` creates `src/video/themes/ocean-blue.ts` from a
   contrast-safe starting point and adds it to the registry in `src/video/themes/index.ts`.
2. Edit the palette, the `keywords` that make `theme: "auto"` pick it, the heading font,
   the background treatment (`flat`, `grid`, `paper`, `glow`, `blocks`, `blobs`, `cinema`),
   the motion personality and the caption style. Use only the bundled fonts (Geist, Inter,
   EB Garamond, Archivo Black, JetBrains Mono; see [licensing](LICENSING.md)).
3. `npx vitest run src/video/themes` fails when text, muted text or accent text on the
   theme's panel drops under the contrast limits; change the colours until it passes.
4. `node scripts/theme-sheet.mjs` renders one storyboard in every theme (including yours);
   look at the sheet in `.artifacts/themes`.
5. Open a PR with the contact sheet attached.

## Preview a scene type

`npm run scene:preview steps` renders that scene type (with a hook before it and a call to
action after it) in all three formats through the frame check and writes the frames and a
contact sheet to `.artifacts/scenes`. Add `REEL_FORCE_ARRANGE=2` or `3` to see the other
arrangements of the type.

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

## Demo media for the README

`npm run demo:assets` regenerates every image and video the README shows into
`dist/demo/` (ignored by git), with `manifest.json` (file, size, cap, source
storyboard) and `index.html` to look at them all. It needs the app running
(`npm run dev`) for the golden storyboards it has not rendered yet, a real Chrome,
FFmpeg, and about 20 minutes.

- Hero (MP4, WebM, GIF; GIF under 8 MB) and six gallery GIFs (each under 3 MB, each with
  an MP4 twin) are cut from the `npm run showcase` renders in `media/showcase/`.
  Choose which storyboards in `HERO` and `GALLERY` at the top of `scripts/demo-assets.ts`.
- Theme and scene-type contact sheets come from `scripts/theme-sheet.mjs` and
  `scripts/scene-sheet.mjs`.
- Screenshots (home, generation view, result, phone), a prompt-to-video screen recording and
  a terminal recording of the real MCP server making a video come from
  `scripts/demo-capture-ui.ts`, which starts a throwaway studio with a fake local writer.

Flags: `--skip-ui`, `--skip-sheets`, `--rerender` (render the storyboards again).
The run fails if a GIF cannot be brought under its cap. The README links the files as assets of
the `demo-assets` release; `npm run demo:assets -- --upload demo-assets` attaches a fresh set
(a public action: only a maintainer runs it).

## The website

`site/` holds the stylesheet, the copy-button script and the Open Graph image; `npm run site:build`
writes the whole website to `dist/site/` (git-ignored): the landing page, the gallery of the
twelve example storyboards (each with its video and its JSON), the MCP install page, and every
guide in `docs/` rendered as HTML by `src/site/markdown.ts`. The build fails on a broken
internal link or heading. There is no analytics and no cookie; videos and images come from
`--media-base` (default: the `demo-assets` release).

To look at it locally, with the media from your own `npm run demo:assets`:

```bash
npm run site:build -- --media-base http://localhost:8801 --site-url http://localhost:8802/
python3 -m http.server 8801 --directory dist/demo &
python3 -m http.server 8802 --directory dist/site
```

The workflow downloads the posters from the release and serves them from the site
(`--poster-dir`), so the first screen does not wait on a redirect; videos load from the release
when played. `.github/workflows/pages.yml` builds the site on every pull request that touches it and
publishes it from `main`. A new guide goes in the `DOCS` list in `scripts/build-site.ts`;
`npm run site:og` redraws `site/assets/og.png`. Pages must be set to "GitHub Actions" as its
source in the repository settings (a maintainer step).

## Pull request checklist

- [ ] Works in portrait, landscape and square with supplied copy and media
- [ ] No personal or copyrighted media committed; asset licences documented
- [ ] Focused contract tests plus **actual exported frames** and a contact sheet
- [ ] `docs/FEATURES.md` updated if a page, route or tool changed

Details from the earlier docs set: [template authoring](archive/guides/TEMPLATE_AUTHORING.md),
[extensions](archive/guides/EXTENSIONS.md), [Scenes and themes](SCENES_AND_THEMES.md).
