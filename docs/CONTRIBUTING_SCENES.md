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

## Add a scene type (15 minutes)

A scene type is one folder, `src/engines/hyperframes/scenes/<name>/`, holding its data shape,
its markup, its styles and a sample. You do not need to read the engine: you write the
markup for the panel, and the engine fits it to the format, the theme and the narration.

You need the repository set up (`npm ci`, see [getting started](GETTING_STARTED.md)); no
voice model, network or API key.

**1. Scaffold it.**

```bash
npm run scene:new pro-tip
```

This creates `src/engines/hyperframes/scenes/pro-tip/index.ts` and `index.test.ts`, then
registers the type everywhere it has to be known (the storyboard format and its JSON Schema,
the plan, the exporter and the tests) and regenerates `schemas/storyboard.v1.json`. If any
registration point has moved, it changes nothing and tells you which one. The scene starts
as a list of 2 to 6 short lines, so it already renders.

**2. Look at it.**

```bash
npm run scene:preview pro-tip
```

This draws your scene (after a hook, before a call to action) at 9:16, 16:9 and 1:1 through
the frame check and writes contact sheets to `.artifacts/scenes/zz-scene-tour-portrait.contact-sheet.jpg`
(and `-landscape`, `-square`). The frame check fails the run when text overflows, runs under the
contrast limit or leaves the safe area, and says which frame. About 25 seconds.

**3. Make it yours.** Everything is in `index.ts`:

| Field                 | What to do                                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `description` | What the scene library shows. One plain sentence for `description`.                                                                                                                                                                                |
| `role`                | What the scene is for, so the motion director can pace it: `hook`, `explanation`, `summary`, `tip`, `emphasis`, `payoff`, `takeaway`, ... (the full list is `PRODUCTION_SCENE_ROLES` in `src/production/roles.ts`).                                |
| `schema`              | The data a storyboard supplies, as a Zod object. Keep `items` (2 to 6 strings) unless the scene needs a different shape; see "A different shape" below.                                                                                            |
| `build()`             | The markup inside the panel. Escape every string with `kit.escape()`. Use `kit.ink` for text, `kit.accent` for accents and `kit.onAccent` for text on an accent. `kit.emphasize()` and `kit.lineStack()` handle highlighted words and line breaks. |
| `css`                 | Styles for the classes you use. Size everything with `px(0.036)` (3.6% of the frame height), never fixed pixels, so one rule serves every format.                                                                                                  |
| `sample`              | Example content for the scene library, the tests and the preview. Make it look good.                                                                                                                                                               |

Run `npm run scene:preview pro-tip` after each change and look at the three sheets.

**4. Test it.**

```bash
npx vitest run src/engines/hyperframes/scenes
```

The scaffold's own tests check that the sample passes its schema, that too few or too many items
are refused, and that markup from a storyboard is escaped. Add a test for anything special your
`build()` does. The registry test also checks that your type plans, exports and draws in the
tour with no repairs.

**5. Use it in a storyboard and document it.** Add a scene with `"type": "pro-tip"` and
`"items": [...]` to a file in `examples/storyboards/` (or your own), run
`npm run examples:lint-frames -- --only <example>` and add a row to the scene table in
[STORYBOARD.md](STORYBOARD.md). Improve the one-line description the scaffold added to
`src/storyboard/schema.ts` (it is what a writing model reads), then run
`npm run storyboard:schema`.

**6. Open a pull request** with the contact sheet attached (see the checklist at the end).

### A different shape

If the scene needs something other than a list (two columns, a number, a picture), add a field
for it to the scene object in `src/storyboard/schema.ts`, require it in the `need` map there, and
carry it in the three places the scaffold wrote `items`: the `panel` switch in
`src/production/storyboard-plan.ts`, the `registered` switch in `src/library/project-storyboard.ts`
and the `panelToFields` maps in `registry.test.ts` and `scripts/scene-sheet.mjs`. Then run
`npm run storyboard:schema`. Search for `"recap"` to find each spot: the scaffold put the new type
beside it.

### Optional: three arrangements

Arrangement 1 is your design. The variety engine can also pick arrangements 2 and 3 to keep a long
video from looking the same; a scene without rules for them just keeps arrangement 1. To add them,
put rules for `.scene[data-arrange="2"]` and `[data-arrange="3"]` in
`scenes/arrangements.ts` (alignment, order, spacing, borders and fills; no transforms, the entrance
animations own those) and look with `REEL_FORCE_ARRANGE=2 npm run scene:preview pro-tip`, and `=3`.

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
- The four README screenshots go to `docs/assets/screens/` and `dist/demo/screens/`.
  The manifest records each JPEG and its source. Run `npm run demo:assets -- --only screens`
  to refresh the README screenshots and their preview entries using one draft video.

Flags: `--skip-ui` (including the README screenshots), `--skip-sheets`, `--rerender` (render the storyboards again).
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
