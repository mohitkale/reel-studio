# Video engines

Reel Studio supports two engines per project (chosen at create time).

|           | **HyperFrames**                            | **Remotion**                                   |
| --------- | ------------------------------------------ | ---------------------------------------------- |
| Licence   | Apache-2.0                                 | Remotion License (source-available, not OSI)   |
| Templates | HTML + CSS + motion (`hf-*`)               | React compositions                             |
| Preview   | Local HyperFrames preview                  | Remotion Player                                |
| Export    | Isolated producer worker → MP4             | `renderMedia` → MP4                            |
| Node      | Node 24 LTS                                | Node 24 LTS                                    |
| Best for  | Open-source-safe workflows, HTML templates | Rich React ecosystem, existing Remotion skills |

## Recommendation for open-source demos

Use **HyperFrames** when you want a fully Apache-2.0 render path that does not
depend on Remotion’s company licensing. Demo seeds in this repo use HyperFrames.

## Remotion licensing (short)

Reel Studio’s MIT licence **does not** cover Remotion. Individuals and small
teams are often covered by Remotion’s Free License; for-profit organizations
with 4+ employees typically need a Remotion Company License. See
[docs/LICENSING.md](LICENSING.md) and [remotion.dev/license](https://www.remotion.dev/license).

## Template IDs

**HyperFrames:** classic `hf-opener`, `hf-statement`, `hf-list`, `hf-stat`,
`hf-quote`, `hf-cta`; curated composition blocks `hf-kinetic-slam`,
`hf-money-count`, `hf-data-chart`, `hf-app-showcase`, `hf-logo-outro`,
`hf-ig-follow`, `hf-tt-follow`, `hf-yt-lower-third`; and native reviewed
carousel adapters `hf-carousel-circle-v1`, `hf-carousel-path-v1`, and
`hf-carousel-vision-v1`. Carousel scenes require at least three project image
assets and never use the upstream demo media.

**Remotion:** `kinetic`, `lottie`, `three`, `stat-reveal`, `icon-grid`, `quote-card`, `emoji-punch`

Registration lives in `src/engines/` and `src/compositions/`.

AI planners select stable capability IDs such as
`remotion.template.kinetic`, `hf.template.statement`, and
`hf.catalog.block.carousel-circle-1`. The engine registry maps each capability
to a compatible internal template ID. This keeps provider schemas independent
of adapter naming and lets a saved catalog revision reject capabilities that
did not exist when the project was created.

## Production presets

Product Launch, Editorial Explainer, Creator Punch, Data Story, Developer Demo,
and Cinematic Brand sit above the engine templates. A versioned production
snapshot resolves each scene role to an engine-supported template before preview
or export. Existing projects retain their selected engine and legacy template
IDs; new projects default to HyperFrames.

Both engines implement each preset with the same copy, source media, timing,
brand snapshot, caption track, and safe-area rules. Their visual effects can
differ because HyperFrames renders deterministic HTML while Remotion renders
React compositions. Portrait, landscape, and square are native layouts in each
adapter rather than crops of a completed video.

HyperFrames producer and CLI are pinned as a matching stable release pair.
Render workspaces contain local GSAP and WOFF2 files, so frame capture does not
need a font or motion-runtime CDN. `npm run sync:hf-catalog` creates immutable
catalog versions and records blocks, components, capabilities, unsupported
items, upstream revision, checksums, dependencies, attribution, and layouts.
