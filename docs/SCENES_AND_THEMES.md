# Scenes and themes

How a storyboard becomes designed motion. Everything here runs locally and is
deterministic: the same content and settings give the same saved decisions.

## Presets, families and treatments

- A **preset** (Product Launch, Editorial Explainer, Creator Punch, Data Story,
  Developer Demo, Cinematic Brand) chooses structure and pacing for the content.
- A **visual family** (Editorial, Graphic, Precision) sets the composition
  vocabulary. It is picked automatically for new drafts and changeable under
  **Visual direction → Visual family**.
- A **motion treatment** is a specific authored scene layout. The library has 29
  treatments; browse them under **Templates → Motion treatments**, pick one in the
  scene inspector and lock the scene to keep it. Six **adaptive recipes** reflow
  supplied content (**Templates → Adaptive recipes**).
- A **colour theme** is separate from the family. Drafts choose a content-matched
  palette; a selected **brand kit** (colours and fonts) overrides it.

The planner picks among compatible treatments, avoids recent repeats and reserves
strong hits for suitable beats. Lists, charts and media need supplied inputs. **Try
another variation** changes only the saved planning seed.

## Direction levels

Clean favors quiet reading layouts, Expressive varies type reveals, Showcase adds
impact beats. Replanning keeps copy, narration, media and locked scenes. Sequence
direction adds lookahead, recurring subjects and a shared-card transition between
neighboring scenes; opt in or out under **Visual direction → Sequence direction**.
Story motion showpieces (for example lunar phases, a seasonal wheel, orbital
rhythms) are illustrations, not calculated astronomy.

## Rendering and fidelity

HyperFrames is the only preview and export engine. Compositions are HTML with one
paused GSAP timeline, so editor seeks and the exporter see the same frames.
Preview and export use the same bundled GSAP and font files under
`public/reel-runtime/`. Supported fonts: Geist, Geist Mono, Inter, EB Garamond,
Archivo Black and JetBrains Mono; unknown brand fonts fall back to Geist. Scripts
that are not covered (for example Devanagari or CJK) need an explicitly bundled
font. Copy is never truncated: fits below 22 authored pixels set
`data-text-fit-warning`, so split long copy into more scenes.

The engine-neutral motion contract (`src/video/motion-spec.ts`) describes shots,
layers, elements and keyframes with no arbitrary HTML, CSS or JavaScript. Models
never see engine internals.

## Verify visual changes

Judge visual work by exported frames, not code. `npm run test:export-fidelity`
checks seeks, fonts, long copy and portrait/landscape exports with an installed
Chromium and FFmpeg; `npm run test:motion-spec` covers the motion contract.
Attach a contact sheet of real frames to any visual PR.

Writing a new template or treatment: [Contributing scenes](CONTRIBUTING_SCENES.md).
Longer references from the earlier docs set are in [archive/guides](archive/guides/).
