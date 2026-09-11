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
