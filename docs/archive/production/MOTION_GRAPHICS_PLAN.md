> **Historical archive.** This document records an earlier plan or measurement.
> Its instructions, versions, pending work, and dual-engine references are not
> current project guidance. See [current documentation](../../README.md)
> and the [published v0.4.0 release](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0).

# Motion graphics in Reel Studio — scope and implementation plan

> Historical plan: engine references describe the earlier dual-engine implementation.
> New previews and exports use HyperFrames only. See [current engine notes](../../VIDEO_ENGINES.md) and [the current review milestones](../CRITICAL_REVIEW_PLAN.md).

Status: implementation started, 2026-09-29. Branch: `feature/motion-graphics`.

The first usable pack ships two treatments each for type (Impact and
Editorial), supplied data (Spotlight and Comparison bars), diagrams (Path and
Orbit), and supplied media (Product frame and Cinematic cover). They include
versioned scene decisions, editor selection and input, production snapshot
persistence, and render paths in both engines. Supplied footage now uses both
media treatments: Product frame contains the whole source, and Cinematic cover uses a full-frame crop. Curated footage stays
muted beneath narration; each scene has one timed source, and arbitrary preview
seeks use the same media windows as export. Short source clips hold their final
frame. Native visual review and bounded chapter production now ship; the
remaining design and quality work is listed below.

Sequence direction now ships with Clean / Expressive / Showcase ambition in
manual and AI creation (including the AI MCP tool). A saved seed gives
repeatable choices, four-scene history discourages layout repetition, and
append continues that history. Quiet preset beats count toward spacing.
Ordered diagrams keep Path automatically; Orbit remains an explicit authored
choice. Screenshot and hero roles retain their appropriate image treatments.
Ambition currently controls type-hit frequency. The editor direction menu and
`replan_motion_direction` MCP tool can apply another ambition or seed without
rewriting content, data, narration, or media. Scene locks and hidden-text scenes
are protected; revision restore retains saved choices, settings, and locks.
Opt-in chapter type motifs now add authored Sweep and Rise entrances across
Impact and Editorial. The saved seed and outline alternate adjacent chapters
and keep one motif within each chapter; compatible chapter openings gain anchor
priority. Replan/append freeze the choice in each scene, protect locks and retain
it through revision restore. Both engines preserve reveal/impact timing, with
no new audio accents or provider calls. Broader choreography
now extends to the other three planned families: Split/Stacked comparison,
Quiet divider/center and Brand lockup/frame. Each pair changes layout and reveal,
rather than only color or easing. Native baseline review across garden, workflow
and archival briefs showed generic headlines did not stage comparison labels,
reading pauses or brand hierarchy. All six new treatments use saved copy, exactly
two supplied comparison labels where required, and the supplied brand name when
usable (blank/overlong names are omitted; no logo is synthesized). Content limits
and longer-copy geometry are shared by both engines. Seeded planning chooses
within compatible roles, respects locks/history and keeps supplied charts/media
on their existing paths. The existing scene menu and list editor expose them;
reading holds and all six treatments remain silent by default.

Sound event timing now ships for the current recipe pack. Authored reveal /
impact landmarks share timing with both renderers; bundled WAV duration and
10 ms RMS peak metadata are verified against the files. The shared resolver
freezes absolute cue frames and each clip's shaped attack into preview, exports,
and production snapshots. It suppresses stale events, short-scene spill and
clashing automatic sounds, with at least two seconds between automatic peaks.
Editorial and image treatments stay quiet by default. Refresh preserves
manual, legacy, muted and locked cues. The music panel now includes sound
choice, level/mute, timing shift, and an explicit return to automatic direction.
Saved edits are protected from refresh; stale saves get an actionable conflict.
REST and MCP share the same edit contract. Transactional updates are verified
against SQLite, including competing edits and refreshes. Local music beat maps
now propose tempo and phase from energy onsets, with a rhythm-confidence label.
Creators can set BPM and first-beat offset, disable beats and mark a drop. Maps
are cached by audio fingerprint, use transactional stale-save checks, repeat
with each track loop, and persist in production snapshots. REST and MCP share
the edit contract. These are directing references; narration-aware cut snapping
is a separate gate. Remote tracks must be imported locally first. Automatic SFX
now avoid measured spoken-word windows with 80 ms clearance. Caption tracks
record source take/frame rate; only matching, untouched local/provider timing
protects audible speech. Caption visibility does not affect this protection;
manual, legacy and locked accents retain creator priority. Local transcription
retains native token timing when available; missing timing never becomes an
estimated word grid. Both engines, preview, prepared exports and durable
snapshots share this resolver. Optional balanced export audio now targets
−16 LUFS with a −1 dBTP ceiling. Two-pass processing finishes the whole mix;
encoded AAC is measured against ±1 LU tolerance and the peak ceiling before
delivery. Video packets are copied, cancellation leaves no partial deliverable,
and authored quiet/loud passages retain their source range when linear gain can
meet the loudness/peak target. The range parameter follows the measured source
so FFmpeg does not silently force dynamic normalization solely because a quiet
hold exceeds the default range; see the [loudnorm contract](https://ffmpeg.org/ffmpeg-filters.html#loudnorm).
Finite mixes outside the encoded target receive at most two measured
corrections. Each pass retains authored start delays, resets the buffered
filter's sample clock and pads/trims to the unchanged video endpoint before
AAC encoding. High-crest accents and speech mixes are verified after encoding.
Checksum-matched measurements accompany production metadata. Original mix
levels remain the default and preview behavior; silent/unmeasurable audio is
explicitly skipped. These are product targets, not platform compliance claims.

The editor now checks treatment input compatibility across the video in the
direction menu. Warnings explain each preset fallback and jump to the affected
scene. Hidden-text scenes intentionally bypass these checks. This uses the
same input contract as both renderers. Variety suggestions now flag runs of
three or more consecutive scenes using the same active treatment and jump to
the start of each run. Preset, hidden and fallback scenes break the run; these
suggestions preserve intentional continuity and never block export.

Visual review now generates scene sheets in pages of eight stills, four
moments of a selected scene, and a 320 px phone-size view. Both native engine
paths include frozen visual media, cover offsets, enabled captions and matching
take timing (otherwise clearly labeled estimates). Stills use revision-keyed
local PNG caches; the editor hides results after saved edits. Capture sessions
are serialized and bounded, with cleanup on cancellation and failure. Dense
transition strips now capture up to eight native frames around a selected
incoming cut, from the outgoing hold through the reveal. Frame-rate-scaled
sampling stays inside the two scenes and includes cover offsets. First scenes
have no incoming storyboard cut. Scene-linked review findings now include
treatment fallbacks, repeated active treatments across sheet boundaries, and
advisory copy-length reading allowances against actual scene holds. Hidden text
does not trigger copy checks; cover offsets and the selected/estimated timeline
are shared with still capture. These are saved-input heuristics, not measured
pixel legibility, language-specific reading rates or design scores.

Native review now measures content text in settled reading frames in both
engines for clipping and safe-area breaches, using native glyph metrics to avoid
false warnings from unused font ascent/descent. Conservative contrast warnings
combine opaque native text paints with captured pixels: a warning requires even
the strongest sampled contrast to fall below its threshold. Bounds, sample
counts and warnings share the frozen still cache. Captions, decorative chrome,
complex text paint, imported blocks without recognized content and animated/cut
frames retain explicit manual review. Passing samples are not whole-video
legibility or accessibility scores. Broader visual grammar review remains below.

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
  production originally rejected outputs over 180 seconds. Full-source local
  chapter planning now removes the 20-scene bottleneck; valid saved chapter
  projects at 24/30/60 fps have a controlled 300-second export limit. AI calls
  remain bounded to 20 scenes each.
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

The chapter-outline foundation now ships: creators can suggest an outline from
matching take timing (or labeled estimates), name sections, choose their first
scene, merge boundaries, and jump to each section. Suggestions remain drafts
until saved. Each chapter contains at most 20 scenes, with at most 12 chapters.
Saving rejects changed scene order or a competing outline without touching
copy, narration, media, motion or timing. REST/MCP share the same contract;
immutable snapshots retain the outline and revision restore maps boundaries to
new scene IDs, including saved sound-cue references. Per-scene text visibility,
muted cues, manual trims, motion anchors and locks survive restore. Cues that
already refer to deleted scenes are omitted. Frozen revision validation supports
bounded 20-scene slices.
Chapter-scoped rewrites now use a bounded provider call with adjacent copy for
continuity, optional narrower scene selection, preserved locks/IDs/motion, and
an atomic stale-draft check. Larger unscoped rewrites are rejected before provider
work; the editor initially selects at most 20 unlocked scenes. REST/MCP share
`chapterId` and `sceneIds` through the existing AI endpoint/tool.
Section export and retry now ship for saved chapter projects: bounded global
frame ranges, checksum-verified local cache records, exact frame coverage,
single continuous audio mix and final mastering. Remotion honors chapter
boundaries with a 30-second cap for frozen local inputs. HyperFrames uses its
native 30-second chunks at 24/30/60 fps; other jobs retain their existing path.
Native worker scratch is isolated from persistent sections and removed on
cancel. Short local music tracks are expanded before HyperFrames' native mix,
because the pinned producer recognizes loop metadata but does not repeat the
source during audio export. Remote music retains the existing producer behavior;
freeze it locally for dependable looping.
HyperFrames verifies the native manifest before computing its silent-section
cache identity. The aggregate plan hash includes freshly encoded assembly
audio, so assembler-only audio and its aggregate plan.json are excluded from
the visual key; all frozen chunk inputs and encoder metadata remain included.
HyperFrames cache identities include the complete visual composition, so editing
one chapter still invalidates every section there. Remotion scopes the actual
silent render to visible scenes and overlapping captions, retaining global
timing and outgoing holds. A visual edit reuses unaffected sections; shared
direction, cover, timing or renderer changes invalidate dependent sections.
The complete audio graph is rebuilt once. Native full/scoped stills match, and
a last-scene edit preserves the opening frames while changing the final visual.
Verified 32-second exports preserve every frame and
looping music across joins, with
identical video packets on retry. The full test suite covers corruption, canceled
work, retention and concat paths containing spaces/apostrophes.
Full-source chapter creation now ships through the wizard, REST and MCP:
`structure: "chapters"` retains every supplied passage, validates bounded
scene slices and persists chapter boundaries atomically with assigned scene IDs.
The browser/SQLite check retained 40 scenes in seven editable chapters.
Drafts over the export limit receive a warning without losing narration.
Valid saved chapter plans at 24/30/60 fps now support 300-second production;
other videos and standalone audio remain at 180 seconds. Submission estimates
match the renderer and include covers, use only the explicitly selected take,
and reject stale timing. Actual prepared timing is checked after synthesis
against the frozen release/token allowance. Token settings and old queued-job
allowances remain unchanged.
Both engines passed the 210-second six-chapter local-speech sample: 5,040 frames,
continuous music through loops/joins, measured encoded audio, cancellation and
unchanged section reuse. Native chapter sheets and eight-frame cut strips were
captured.
This enables a bounded first long-video release. The existing AI Add scenes
workflow can now append a named chapter to a valid saved outline in one bounded
generation. Browser, REST and MCP accept an optional `chapterTitle`; leaving it
blank extends the last chapter. Capacity is validated before generation: 12
chapters, 240 total scenes and 20 scenes per chapter. Automatic append asks for
3–5 scenes; explicit requests support 1–20. Only the final two scene excerpts
and saved chapter titles provide continuity context. Existing scenes, locks,
chapter IDs/boundaries and brand/audio settings are preserved. Scenes, stock
snapshots and the new boundary commit together, or a storyboard edit during
generation rejects the entire append with a reload/retry message. No new
provider calls, token allowances or automatic retries are introduced.
Topic planning now saves an editable writing draft of titles, source-grounded
briefs and scene counts in one bounded generation, with existing provider/token
limits. Browser, REST and MCP use the same bounds and reject concurrent storyboard
edits. Saved draft edits use optimistic comparison without another provider call;
failed/malformed/canceled generation preserves previous work. Writing drafts
survive reload and revision restore without creating scenes or changing render
inputs. Reviewed drafts now generate the next pending chapter with one explicit
bounded request at a time. Scenes, chapter boundaries and completion progress
commit atomically; failures stay pending for a chosen retry and completed chapters
cannot append twice. Progress survives reload/restoration with remapped scene IDs;
completed chapter revisions use the existing scoped rewrite. Capacity counts only
pending work. Browser/REST/MCP share the same fixed one-call budget and provider
quotas. Automatic multi-call orchestration and retry stay disabled.

Plan long work in **chapters**, each with its own small arc and visual motif,
while retaining a shared brand language. Use quiet beats and footage or
explanation holds; do not force social-video cuts every 2–4 seconds. Reintroduce
motifs at chapter boundaries, vary scene families across the whole piece, and
reserve hero animation for chapter openings and conclusions.

Further long-form work should add broader duration/quality/media benchmarks.
Preserve bounded calls, selective chapter rewriting and existing token policies. Extend selective visual reuse to
HyperFrames only when the native compiled inputs can be safely scoped.

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
  cancellation/retry, and visual review. The 210-second sample passed the first
  controlled 300-second chapter release gate. Broader media and quality settings
  need their own measured fixtures before expanding the policy again.
- Track render time and memory per minute and per quality setting. The default
  should not acquire an unbounded per-frame or multi-sample cost.

## Explicit scope boundaries

Do not create dozens of new top-level presets, execute arbitrary AI-generated
code during user production, auto-copy a reference video's assets or exact
composition, make a new video renderer, or enable expensive blur for every
frame. Build a small set of excellent authored recipes and a planner that uses
them with judgment. Expand the library only after real renders show where its
creative range is lacking.

## Implementation and evaluation status

The first recipe pack, deterministic direction, synchronized accents, music
maps, measured audio mastering, native review, chapter authoring and bounded
chapter production are implemented. The three original follow-ups are complete:

The broader choreography item is complete with two authored treatments per
family in both engines, in addition to chapter Sweep/Rise. Narration-aware cut review now ships as advisory frames in the music panel, REST
and MCP. Explicit saved-map review, verified local music and matching measured
word timing protect speech, reading holds and locks without changing creator
timing. Selective HyperFrames reuse now freezes actual silent native section projects,
scopes scene/media/caption inputs while retaining global timing, and hashes each
compiled native manifest. Imported catalog blocks retain conservative whole-plan
reuse. Continuous audio is freshly assembled; cold exports add bounded native
planning work.

The five-minute footage matrix passed six native exports and unchanged retries:
three quality profiles in each engine, with measured encoded resolution,
continuous mastered audio, exact video coverage and bounded native/encoded review.
The explicit high-only finishing experiment preserves coverage and encoded audio
and reports additional time/memory cost. Reviewed temporal smoothing softens
moving copy and adds visual lag, so it remains outside default production; it is
not subframe motion blur. The duration policy remains bounded at 300 seconds.
Measured results, fixture scope and the final responsive media fixes are recorded
in [LONG_VIDEO_BENCHMARKS.md](LONG_VIDEO_BENCHMARKS.md).
