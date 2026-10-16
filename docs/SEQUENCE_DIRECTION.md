# Sequence direction and subject continuity

M3 adds a local sequence director and a narrow shared-card transition on top of
[adaptive recipes](ADAPTIVE_RECIPES.md). It changes eligible visual choices, not
copy, narration, supplied relationships or timing. No model, provider call,
additional dependency or external animation pack is needed.

## Use it

New production plans enable sequence direction. Existing films retain their saved
settings; use **Visual direction → Sequence direction** to opt in or out. Locked
and hidden-text scenes remain protected. Locking an M3 scene retains its subject
styling and disables handoffs at either boundary. A previously locked M2 scene
keeps its prior appearance when the rest of the film opts in. Supported semantic illustrations keep
precedence over decorative alternatives. A scene's **Why this visual?** explains
the saved choice and offers up to two compatible alternatives. Editing the source
marks that explanation stale until replanning; choosing an alternative replaces
only the scene's treatment.

**Subject identities** lists the registered labels, explicit aliases and brand
color slots. Literal labels match after Unicode/whitespace normalization; case
and different wording stay distinct. The director never uses fuzzy matching or
an LLM to merge entities. IDs and color slots survive scene reordering, appended
scenes and revision restoration. Appending scenes registers new labels in the
same transaction, so the identity editor immediately includes them. A configured alias retains the existing identity
when the displayed label differs. Ambiguous aliases are rejected. To merge two
existing entries, remove one draft entry and add its label as an alias of the
retained entry before saving. Unclaimed labels still present in scenes register
again automatically. Closing the dialog discards unsaved changes.

Saving identities replans unlocked scenes. Colors refer to your existing Accent,
Secondary accent or Ink token; changing the brand updates those colors together.
The registry also retains supplied semantic symbols. M3 only draws shared subject
colors and handoffs on compatible adaptive comparison/process panels; semantic
illustrations and media retain their own authored visual behavior.

REST `POST /api/scripts/:id/motion` and MCP `replan_motion_direction` accept
`sequenceDirection` and optional `subjectRegistry`, through the same atomic
service. The registry entries contain `id`, `label`, `aliases`, `symbol`, and
`colorSlot`. A full registry replacement is validated before writing. Existing
scene editing and film-plan JSON checkpoint routes remain available.

## How direction is resolved

Hard constraints admit candidates first: required content, supported meaning,
complete copy, canvas fit, duration, hidden text and locks. Actual narration may
resolve later; final geometry is checked again against measured timing. Search
is deterministic for the same source, settings and seed, with at most six
candidates, a three-scene horizon and six retained paths. It scores composition
silhouette, movement, density, recent emphasis and recurring subject identity.
Reusing a card for the same subject is intentional continuity, not a repetition
error. Unflagged saved plans retain the M2/legacy planner.

Decisions and their compatible alternatives are stored with scene motion and a
source key. The registry is saved with motion-plan settings. Resolved film-plan
JSON uses resolver `1.2.0` when sequence direction is enabled, including the exact
subject ports, boundary reasons and handoff geometry/timing. M1/M2 plans keep
resolvers `1.0.0`/`1.1.0`. The composition-level adapter is pinned as
`adaptive-panel-handoff@1.0.0`; it does not rewrite M2 recipe manifests.

## Supported handoff

The first adapter carries one recurring subject card between adjacent admitted
adaptive comparison/process scenes. Both ends must be unlocked, visible, in the
same visual family, use the same row/column text arrangement, have contiguous
content timing and allow at least three seconds each. The first shared subject
in source reading order is selected. Other subjects retain their panels.

The transition occupies 0.25 seconds before the next beat and 0.35 seconds after
it. It changes neither beat starts nor audio. One prebuilt overlay interpolates
between the two frozen boxes; source/target wrappers avoid duplicate subjects.
The overlay is a declared timed scene and uses the same per-scene GSAP clock
as the other native recipes, composed into the root timeline. Arbitrary/reverse seeking needs no
callbacks, runtime cloning or provider decisions. Unsupported pairs keep the
existing transition with a recorded reason.

Sequence-enabled exports longer than 30 seconds use the existing section path
at 24/30/60 fps; saved chapter workflows retain their existing behavior.
A section intersecting a handoff includes both endpoint scenes. Thus edits to
either endpoint invalidate the affected section artifacts as well as that
scene's own section. Unrelated later sections remain reusable. Existing native
manifest validation, media dependencies and fresh audio assembly remain intact.

This is not arbitrary shape morphing, cross-scene media transfer, chapter-level
planning, or a general animation graph. M4–M6 remain separate milestones. See the
[upgrade plan](ADAPTIVE_CONTENT_FACTORY_PLAN.md) and
[M3 acceptance record](production/ADAPTIVE_M3_VALIDATION.md).
