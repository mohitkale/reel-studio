# Adaptive recipes

Six bundled recipes use the same saved scene content in the editor, REST/MCP
planning and isolated-worker export. They require no provider calls, downloaded
models or external catalog installation. They extend the existing motion library
to 29 treatments and share the Editorial, Precision and Graphic visual families.

## Explore and apply

Open **Templates → Adaptive recipes**. Search by intent, select a recipe, and
change preview format, family or seconds. The demonstration copy and evidence
are synthetic. In the editor's scene inspector, **Adaptive recipes** previews
that scene's complete saved content and brand tokens. **Use this recipe** saves
the recipe version and family; the preview format/time controls do not edit the
film. Locked scenes must be unlocked before applying.

New production plans enable adaptive selection locally. Existing saved plans
retain their settings. Use **Motion direction → Adaptive recipes** to opt an
existing film in or out, then replan through the shared service. REST
`POST /api/scripts/:id/motion` and MCP `replan_motion_direction` accept the same
optional `adaptiveRecipes` boolean. Supplied semantic illustrations and locked
scenes take precedence. Unordered feature lists never become ordered processes
automatically; a process requires an explicit diagram role or manual selection.

## Content and adaptation

| Recipe              | Supplied inputs                                                                          | Adaptation                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Concept focus       | 1–260 characters                                                                         | Focused headline, conservative type fit and reading hold                     |
| Adaptive comparison | Headline up to 180 characters; 2–4 alternatives, each up to 96 characters                | Columns, grid or stack based on format and density                           |
| Progressive process | Headline up to 180 characters; 2–6 explicitly ordered steps, each up to 96 characters    | Numbered route, grid or vertical sequence; connectors stay in gutters        |
| Evidence ledger     | Headline up to 180 characters; one series of 1–6 nonnegative values with matching labels | Metric, ledger or bars; exact values, unit, series label and source retained |
| Media study         | 1–260 characters and a supplied image                                                    | Contained image with side or stacked copy; full image preserved              |
| Editorial reading   | 1–600 characters                                                                         | Complete reading canvas with fitted type and hold                            |

Evidence labels allow 48 characters, values 14 characters, units 12, series
labels 60 and attribution 160. Character limits are admission ceilings, not a
promise that every string fits every canvas. The resolver checks the actual
available area at a minimum type size and reports a fallback when it cannot fit
complete copy. It never truncates inputs or invents values. Extra chart/list/media
content, saved illustrations, hidden text, unsupported video, missing inputs or
unsupported timing retain the existing renderer with an explanation.

Each scene supports 1–120 seconds. Short scenes reveal content early and show a
reading-window warning; longer scenes stagger arrivals and focus cues before a
hold. Layouts resolve separately for portrait, landscape and square using the
existing production safe areas. A fixed, conservative text estimate keeps
preview and exports deterministic; it does not measure fonts at render time.

Brand tokens remain authoritative. Families change framing and typography;
they do not silently replace the saved brand palette. All six use the pinned
local GSAP timeline and support reverse seeking. The original demo SVG is
bundled under the repository MIT license.

## Saved plans and limits

Adaptive `1.0.0` recipe manifests and resolver `1.1.0` freeze the selected variant,
geometry, type sizes, event schedule, reasons and warnings in film-plan JSON.
Manifest and source hashes are checked during checkpoint saves. Compatibility
plans continue using resolver `1.0.0`; old revisions are not migrated in place.
Final export preparation resolves against its actual canvas and measured timing
using the pinned recipe implementation; submitted plans remain provenance.

M2 supplies per-scene adaptation. Subject identity, sequence search, object
handoffs, chapter direction and batch versions remain later milestones in the
[upgrade plan](ADAPTIVE_CONTENT_FACTORY_PLAN.md). This is not yet certification
of the full baseline corpus or all local AI models. See the
[M2 validation record](production/ADAPTIVE_M2_VALIDATION.md) for measured coverage.
