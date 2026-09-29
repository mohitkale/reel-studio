# Motion graphics in Reel Studio — scope and implementation plan

Status: implementation started, 2026-09-29. Branch: `feature/motion-graphics`.

The first three vertical slices ship two treatments each for type (Impact and
Editorial), supplied data (Spotlight and Comparison bars), and diagrams (Path
and Orbit). They include versioned scene decisions, editor selection and input,
production snapshot persistence, and render paths in both engines. Media,
sound, review, and long-form milestones below remain planned work.

## Product decision

Keep Reel Studio's production presets as **story and brand direction**. Add a
small, curated **motion recipe system** that chooses how each scene expresses its
idea. A recipe is a designed visual composition with a few safe variations,
timing anchors, and optional sound cues. The planner may select and parameterize
recipes; it must not generate arbitrary runtime code for ordinary users.

HyperFrames remains the default engine for new projects and the first home for
new GSAP/SVG recipes. Remotion remains supported through frame-driven
implementations of the same _intent_; a project keeps its chosen engine. Do not
attempt to run GSAP inside Remotion or promise pixel-identical effects across
engines. The system should preserve the same information, timing, brand, and
quality standards in both.

The aim is a strong default cut that can be directed into a showcase piece.
Exceptional work still needs real source material, deliberate art direction,
and visual review. A larger prompt or a larger template list alone cannot
guarantee it.

## What the existing code tells us

- There are six versioned production presets and role-to-template mappings in
  `src/production/presets.ts` and `preset-template-map.ts`. Roles, mood, and
  energy are already represented, so this should extend those concepts.
- In preset projects, Remotion's `ReelComposition` chooses the preset scene
  component before `scene.templateId`. HyperFrames' composition builder also
  tries the preset scene builder first. Consequently, the saved template ID is
  often not the visible composition. Fix this precedence explicitly as recipes
  are introduced; adding more template IDs alone will not create variety.
- `ProductionSpec` v1 already freezes engine, preset, brand, scenes, frame
  timing, assets, captions, and audio. `Scene.layoutJson` carries editable
  per-scene settings. A versioned motion plan can follow the same snapshot path.
- Music is a single script track with ducking. Auto SFX is selected by template
  and timed near scene start. That cannot accurately land sounds on visual hits.
- Automatic creation is short-form today: the manual planner caps a source at
  20 scenes, AI endpoints cap a generation at 20 scenes, and durable video
  production rejects outputs over 180 seconds. The spec's 240-scene ceiling
  does not make long-form production available.
- HyperFrames already has local GSAP, seekable preview, pinned catalog assets,
  and a worker render path. Remotion already has frame-based motion, preview,
  and export. Preserve those working paths.

## The smallest useful design system

Use **seven scene families** as the target vocabulary, built by improving or
wrapping existing work instead of adding seven unrelated production presets.
Ship the first four families (type, metric, diagram, media) in the first usable
pack; existing preset scenes cover the remaining roles while the pack grows.

| Family                | Use                                | Initial visual grammar                                  |
| --------------------- | ---------------------------------- | ------------------------------------------------------- |
| Type statement        | hook, headline, takeaway           | masked type, scale/position contrast, one strong accent |
| Metric and data       | a supplied number or chart         | count/draw/reveal with units and source retained        |
| Diagram               | process, relationship, explanation | SVG nodes, connectors, paths, progressive focus         |
| Media stage           | product, screenshot, photo, video  | perspective, crop, depth, annotated callouts            |
| Comparison            | before/after, alternatives         | split, wipe, side-by-side, aligned labels               |
| Chapter or quiet beat | reset, context, longer narrative   | purposeful hold, ambient motion, title/section marker   |
| Brand payoff          | resolved idea, CTA, logo           | assembly/reveal with a clear final hold                 |

Each shipped family gets **two genuinely different compositions** before more
families are added. Variants may change layout, hierarchy, direction, camera path,
motion verb, and tempo. Palette swaps, random particles, and a new entrance
ease do not count as a second composition. Reuse a small set of motion
primitives (masked text, path draw, stagger, camera move, reveal, hold) but
compose them differently per family. SVG is the default for explainable
diagrams, charts, and geometric motion; GSAP drives seekable choreography in
HyperFrames. Use Lottie/3D only where the scene actually needs them.

Keep each recipe's authoring contract small: stable ID and version, eligible
roles, required inputs, supported ratios/engines, content limits, safe areas,
motion variants, anchor points (`enter`, `reveal`, `impact`, `hold`, `exit`),
optional SFX mapping, and an explicit fallback. A recipe must work with no
stock asset unless it declares an asset requirement. A data recipe must never
invent values, logos, capabilities, or attributions.

## Direction model and selection

Add one typed, bounded `MotionPlan` between scene planning and rendering:

```text
video: recipe-pack version, seed, pacing arc, optional music anchors
chapter: purpose, visual motif, intensity range
scene: family + recipe variant, emphasis, motion character, density,
       key visual moment, transition, optional sound accents, lock state
```

The input is the brief/script, scene role, available assets and verified data,
brand kit, voice timing, music (if selected), ratio, and neighboring scenes.
Selection should follow this order:

1. Reject recipes whose required inputs, text limits, ratio, engine, or
   duration cannot be satisfied. Use a readable fallback with a visible reason.
2. Choose a content-appropriate family. A chart needs real chart data; a
   screenshot scene needs a supplied image. Semantic fit outranks novelty.
3. Score compatible variants for brand fit, narrative importance, duration,
   and contrast with recent scenes. Repetition penalties should act on
   composition and motion character, not merely recipe ID.
4. Allocate a few high-effort **hero beats** to the opening, decisive proof,
   or payoff. Most connective beats should be simpler so the hero moments land.
5. Resolve exact frame anchors and sound cues after voice/music timing is
   known. Save the chosen IDs, parameters, seed, and versions in the immutable
   production revision so preview, export, retries, and regenerated formats
   use the same decisions.

The deterministic planner must work without AI. Optional AI may suggest
chapter structure, scene purpose, emphasis, reference _grammar_, and rank
catalogued recipes through a strict schema. It cannot submit HTML, GSAP code,
arbitrary asset URLs, or unverified factual claims into a normal production
job. A user reference can guide pacing, typography, or transition language;
use original content and appropriately licensed assets.

## Sound and timing

Visual rhythm comes from the message and narration first. If music is present,
analyze it once and show a proposed beat/downbeat map with confidence. Let the
user move or disable anchors, especially the key drop. Keep voice timing and
legibility ahead of rigid beat snapping. Scene cuts may land on music; every
scene need not start on a beat.

Replace template-start SFX suggestions with **event cues**: a cue points to a
scene's named visual anchor and a library clip whose audible peak offset is
known. Resolve its final absolute frame after the motion plan is timed. Limit
accents, prevent collisions with words and each other, and preserve existing
user-edited cues. Continue using the shared audio mix and local bundled assets.
Measure final loudness and true peaks; choose output targets after checking
platform requirements rather than hard-coding a claim from a social post.

The pasted reference's seek-by-time principle, early stills, peak-aligned SFX,
and contact sheets are useful product patterns. Its eight-subframe motion blur
method is too expensive for a default render; investigate it only as an
opt-in finishing quality after base motion is excellent.

## User experience

- Creation: choose a story preset and output ratio as today. Add one plain
  control for visual ambition: **Clean**, **Expressive** (default), or
  **Showcase**. Explain that Showcase spends more design and render effort on
  selected hero beats. Do not expose a grid of motion knobs in the wizard.
- Storyboard: show each scene's visual family and a few representative stills
  before a full render. Let users swap a compatible variant, set the focal
  moment, lock a scene, and regenerate the remaining direction without changing
  copy or audio. Show missing inputs and why a fallback was selected.
- Advanced direction: offer per-scene motion character, intensity, transition,
  and timed sound accents. Keep the current engine choice and editable scenes.
  A custom recipe authoring route can use the existing template authoring and
  catalog review process; it is not a prompt that executes generated code.
- Review: render four key stills first, then a contact sheet spanning the cut,
  a dense strip around fast transitions, and a phone-size view. Present
  actionable findings with timestamps for text clipping, contrast, missing
  data/source, safe-area violations, dead holds, and repeated visual grammar.
  Human review decides taste; automatic scores should not claim to certify
  award-winning design.

## Long videos

Plan long work in **chapters**, each with its own small arc and visual motif,
while retaining a shared brand language. Use quiet beats and footage or
explanation holds; do not force social-video cuts every 2–4 seconds. Reintroduce
motifs at chapter boundaries, vary scene families across the whole piece, and
reserve hero animation for chapter openings and conclusions.

Long-form support is a separate product milestone. Remove the 20-scene
planning bottleneck with chapter-wise planning and selective regeneration.
Raise the 180-second production limit only after bounded chapter render,
resume/cancel, audio continuity, memory use, and export stitching are verified.
Do not silently change existing API/MCP limits or token policies. A long video
should be renderable in sections so a change to one chapter does not require
rebuilding every frame.

## Implementation order

### 1. Motion contract and a vertical slice

- Define/version the motion recipe registry and Zod plan schema in
  `src/production/`; store editable direction in `Scene.layoutJson` (or a
  versioned sibling only if the current field proves too narrow), and freeze
  the resolved plan in `ProductionSpec`/video snapshots. Preserve v1 and
  existing project behavior through explicit defaults/migration.
- Remove the preset-first rendering ambiguity with a shared recipe selection
  point. Keep current preset renderers as legacy fallback. Add one distinct
  family with two variants in HyperFrames and matching Remotion behavior.
- Verify seek to an arbitrary frame, preview/export parity, all three ratios,
  and regeneration stability before growing the library.

### 2. First usable pack and direction planner

- Ship type, metric, diagram, and media families with two distinct compositions
  each by reusing suitable existing preset/catalog visuals. Add eligibility
  metadata, input checks, seeded selection, repetition scoring, and hero/quiet
  beat allocation. Ensure deterministic output without a provider and validate
  any AI suggestion against the same contract. Expand to comparison, chapter,
  and brand payoff after reviewing real output for gaps.
- Add storyboard stills, family/variant selection, locks, and a few documented
  ambition defaults. Keep REST/MCP creation and edit paths equivalent.

### 3. Sound and visual review

- Add named motion anchors, music-map review, peak-aligned SFX metadata, and
  audio collision rules. Make preview and export use identical cue frames.
- Add contact-sheet/phone-size review and checks for legibility, timing, safe
  areas, facts, and repeated compositions. Cache stills and render only the
  affected section where the engine safely supports it.

### 4. Long-form production and optional finishing

- Add chapter-wise planning/render/retry, cross-chapter audio and visual
  continuity, and controlled higher duration limits. Keep policy limits
  separate for browser, REST, MCP, and batch calls.
- Evaluate higher sample motion blur and heavier effects only behind a
  measured high-quality option, with explicit time and resource cost.

## Release gates

- A blind review of multiple unrelated briefs should find distinct composition
  and motion choices within the same preset; changing text/colors alone fails.
- For a fixed source, brand, seed, assets, recipe versions, and timing, arbitrary
  seeks and repeat renders produce the same frames and cue positions.
- Required input failures produce a readable, explained fallback; numerical
  visuals use supplied values and retain labels, units, and attribution.
- Both engines remain usable; new recipes report engine support honestly.
  Portrait, square, and landscape stay readable at phone size and within safe
  areas. Captions, voice, music, and SFX remain synchronized.
- A short sample and a multi-chapter long sample pass preview, export,
  cancellation/retry, and visual review. The long sample is a gate for raising
  the current 180-second limit, not a claim about today's release.
- Track render time and memory per minute and per quality setting. The default
  should not acquire an unbounded per-frame or multi-sample cost.

## Explicit scope boundaries

Do not create dozens of new top-level presets, execute arbitrary AI-generated
code during user production, auto-copy a reference video's assets or exact
composition, make a new video renderer, or enable expensive blur for every
frame. Build a small set of excellent authored recipes and a planner that uses
them with judgment. Expand the library only after real renders show where its
creative range is lacking.
