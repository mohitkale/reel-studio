# Production contracts

Production jobs consume a validated, immutable `ProductionSpec` from
`src/production/spec.ts`. Version 1 records the source revision and content hash,
engine adapter and catalog revision, preset version, resolved brand values, canvas,
assets, scenes, narration readiness, captions, audio cues, timing and requested
artifacts. Workers must store this snapshot rather than reading mutable project
records while a job is running.

## Presets and overrides

The built-in `1.0.0` preset set is Product Launch, Editorial Explainer, Creator
Punch, Data Story, Developer Demo and Cinematic Brand. Each preset supports both
engines and declares its scene roles, pacing, typography, spacing, palette,
captions, transitions, music mood and sound-effect intensity.

Resolve values in this order:

1. preset defaults;
2. brand-kit values;
3. explicit project values;
4. explicit scene values.

The resulting values belong in the production snapshot. A later preset or brand
edit must not restyle a queued, completed or reopened production implicitly.

## Engine capability metadata

Every engine adapter publishes its supported aspect ratios and a capability entry
for each template. Entries include their version, compatible scene roles, required
inputs and effects. Planning code must select templates through this metadata and
must validate required inputs before preview or export.

HyperFrames HTML remains inside the HyperFrames adapter and Remotion React
compositions remain under `src/compositions`. Effects can differ between engines,
but both receive the same resolved content, timing, brand and asset snapshot.

## Existing projects

`productionSpecFromLegacyScript` maps v0.3 projects without changing their stored
engine or template IDs. It keeps both the source template ID and the engine's
resolved fallback ID so old projects remain addressable. It also snapshots legacy
media, sound cues, voice provider data and timing. Missing, placeholder and stale
narration are recorded explicitly and cannot be mistaken for ready audio.

Schema validation rejects duplicate IDs or scene positions, dangling media
references, incompatible output formats, malformed chart series, out-of-range
scene/caption timing and inconsistent total duration.

## Layout and media resolution

`resolveProductionComposition` is the handoff to preview and export. It maps a
validated snapshot into one `ReelProps` object, including resolved asset URLs and
format-specific layout values. Browser previews can map an asset to an app URL;
render workers can map the same asset to a local materialized path without
changing scene, timing or style decisions.

Portrait, landscape and square each have explicit safe areas, content/caption
widths, caption and brand insets, progress-bar size and type scale. Both engines
consume these values. Format variants must resolve the source content again for
their canvas; they must not crop a previously rendered video.

## Factual data and catalog personalization

Charts accept structured labels, finite values, series labels, units and optional
source attribution. The same structure is stored in scene layout data and carried
through AI plans, JSON import/export, undo snapshots, production specifications
and both renderer inputs. A chart layout without that structure resolves to a
non-data statement; narration copy is never mined for values. Count-up templates
likewise require an explicit numeric visual.

Catalog demos are treated as source material rather than production content.
Data-bound blocks render through validated native adapters, so example people,
metrics, URLs and app screens cannot leak into an export. User-controlled values
inserted into catalog markup or script literals are encoded for their destination,
and logo cards display a domain only when one was supplied explicitly.

## Product Launch 1.0.0

Product Launch carries hook, screenshot demo, feature, comparison and CTA roles
into both renderer inputs. HyperFrames uses a seekable HTML treatment and
Remotion uses a responsive React treatment, while the copy, media, timing and
brand snapshot stay shared. Screenshot demos require a supplied image or video.
Feature and comparison cards display only supplied item copy, and CTA buttons
appear only when an explicit action label is present.

The credential-free acceptance fixture uses the bundled dashboard screenshot at
`public/samples/product-launch-dashboard.svg`. Run
`npm run test:render:product-launch` to render and inspect all five roles through
both engines.

## Editorial Explainer 1.0.0

Editorial Explainer carries headline, explanation, diagram, quote and summary
roles into the shared composition input. Both engines render a responsive
paper-inspired system with readable typography, restrained emphasis, labeled
diagram steps and optional quote attribution. Remotion calculates composition
duration from the supplied scene timeline, so longer editorial sequences are not
clipped by a fixed root duration.

The credential-free acceptance fixture contains five editorial scenes and no
remote assets. Run `npm run test:render:editorial` to render the complete
12-second sequence through both engines.

## Creator Punch 1.0.0

Creator Punch carries hook, tip, emphasis, payoff and CTA roles into both
engines. The renderers use high-contrast creator typography, selective visual
symbols, beat-oriented entrances and responsive tip cards while preserving the
same copy, timing and brand snapshot. The CTA label appears only when explicit
item copy is supplied.

Run `npm run test:render:creator-punch` for the credential-free 10-second
portrait fixture. The render gate inspects role boundaries and verifies the
complete H.264 output from both engines.

## Data Story 1.0.0

Data Story carries metric, chart, comparison and takeaway roles into both
engines. Metric scenes require an explicit display value. Chart and comparison
scenes require structured labels and series values, with optional units and
source attribution. Both renderers scale bars from the supplied values and
display the exact supplied labels; they never infer numbers from narration.

Run `npm run test:render:data-story` for a credential-free 10.5-second fixture
covering a metric, four-point chart, two-point comparison and takeaway. The
fixture values and attribution are asserted in the composition contract test.

## Developer Demo 1.0.0

Developer Demo carries code, diff, terminal, browser and CTA roles into both
engines. Code-like content is supplied as scene items and encoded as text before
rendering. Diff rows preserve explicit `+` and `-` markers, while browser proof
requires a supplied image or video asset. The adapters do not execute displayed
commands or source code.

Run `npm run test:render:developer-demo` for a credential-free 12-second
fixture. It embeds the bundled browser dashboard as a local data URL so the
render remains offline and deterministic.

## Cinematic Brand 1.0.0

Cinematic Brand carries hero, feature, testimonial and logo roles into both
engines. Hero scenes require a supplied image or video asset. Testimonial text
and attribution must be supplied explicitly, while the logo close uses the
provided short mark and brand snapshot. Motion stays measured and the adapters
apply a vignette, subtle texture and readable foreground treatment.

Run `npm run test:render:cinematic-brand` for the credential-free 12-second
fixture. The bundled hero image is embedded locally for deterministic rendering.

## Durable production jobs

Production jobs store an immutable JSON input snapshot and a unique idempotency
key in SQLite. Workers claim queued jobs with an expiring lease, extend it with
heartbeats, and can recover work after a crashed worker's lease expires. Queued
jobs cancel immediately; running jobs receive a cooperative cancellation flag.
Steps, ordered events and output records survive web or worker restarts.

The shared pipeline step keys are validate, plan, resolve media, synthesize
audio, time content, prepare composition, render/export and verify artifacts.
The production worker is available through `npm run production:worker`. Video
jobs pass through all eight stages and reuse the existing engine-aware render
service. A job cannot succeed until `ffprobe` confirms a decodable MP4 with
positive dimensions and duration, and an audio stream when the chosen take
requires one. The verified artifact is stored with SHA-256 and media metadata.
