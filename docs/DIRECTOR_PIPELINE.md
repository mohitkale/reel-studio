# Director pipeline

Reel Studio applies content-aware direction to the existing no-key planner and the same
validated local/OpenAI/Gemini scene contract. Direction is data, never generated
HTML, JavaScript or an unrestricted animation graph.

## Source and planning

The deterministic planner preserves supplied copy and recognizes explicit
percent/currency/multiplier metrics, 2–6 `Label: value` chart rows (newline or
semicolon separated, matching units), 2–5 short list rows, quoted phrases, and
`A versus B` comparisons. It does not infer a dataset from unrelated numbers.
Charts from AI output require matching supplied label/value/unit pairs; numeric
visuals require an exact supplied metric and source attribution must occur in
the input. Rejected data falls back to a text scene. These display-data guards
are not a general fact checker for AI-written narration; review generated copy.

A normalized source-derived seed makes initial motion choices reproducible.
Automatic AI creation selects a compatible preset family and curated palette
from the brief, then lets the model choose style and energy when these are Auto.
Themes store their concrete palette in the draft and revision. User-selected
presets/styles, customized brand kits and scene locks take priority. Suggested
AI motion is admitted as a planning hint, not a user lock, so the sequence can
avoid needless repeats without inventing structural inputs.

New drafts also freeze an Editorial, Graphic or Precision motion family. This
bounds a coherent vocabulary while recent-history penalties vary compatible
layouts. Existing saved choices remain unchanged until replanned. The optional
`motionPlan.system` field survives append, snapshots and revision restoration;
older plans without the field retain their original planning vocabulary. Explicit
Visual direction replanning can adopt a new family. See [motion presets](MOTION_LIBRARY.md)
for composition, content admission and export verification details.

Optional version-1 shot direction chooses an authored treatment or a bounded
text/shape layered title, plus an admitted existing motion recipe. Media,
charts, lists and long text retain authored treatments. Invalid, unknown or
executable direction fields fail schema validation. Local and frontier providers
use the same admission rules. OpenAI's strict JSON schema makes optional fields
required and nullable as specified by its
[structured-output contract](https://developers.openai.com/api/docs/guides/structured-outputs).

A compatible saved motion treatment takes precedence over the basic layered
title. Prose uses text layouts when a preset's diagram/quote slot has no matching
structure. Explicit transitions (“a shift from X to Y”) provide two literal
comparison labels in creation and local visual replanning; no labels or numeric
values are invented. Existing supplied diagrams and scene locks remain protected.

Selecting a cloud planner authorizes its one initial call. The project API also
accepts `directorBudget: { maxPaidCalls: 0 | 1 }`; explicit zero rejects a cloud
planner before credential access or invocation. No-key planning and layout
repair use zero paid calls. Planning does not automatically replay paid work.

## Frozen direction and current timing

### Automatic illustrations and story continuity

New production drafts plan the meaning of a scene before assigning decorative
type. Optional `direction.graphic` uses a bounded grammar: a single concept,
a comparison of 2–4 subjects, or a flow of 2–4 ordered steps. The model proposes
labels and semantic symbols; the local planner also recognises explicit
definitions and named alternatives. Native vector artwork depicts search,
answers, sources, documents, code, people, growth, goals, protection, time,
ideas and media. Users do not need to supply graphic settings.

A pass across the story reuses actual subject definitions in comparison
overviews. A frozen `sourceQuote` may establish a subject's symbol from another
scene; preview and export check that the quotation still exists in the current
story. Local labels and details must occur in that scene's copy or narration.
Flows preserve supplied order and require an explicit progression. Comparisons
with an explicit shared relationship can use a qualitative overlap diagram
for two or three short subjects; the regions do not imply quantitative sizes.
Supplied
charts, lists, media, custom visuals and whole-scene locks remain authoritative.
Family changes preserve admitted illustrations. Explicit template or treatment
edits remain optional overrides.

Malformed optional graphic proposals are discarded without discarding the
script. Unsupported symbols, stale labels, missing source quotations and
invented relationships cannot render as illustrations. These checks establish
visual relevance to the script, not general factual accuracy. AI copy still
requires review. For bare SEO/AEO/GEO idea prompts, the app supplies
[Google's published terminology and overlap guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
as source context. Other topics are not automatically researched.

Short AI drafts normally request 5–7 complete beats with concise headlines and
separate explanatory narration when useful. Illustrations omit a repeated
detail sentence when the headline already contains it. Frozen direction is
revalidated after copy edits and survives creation, append, snapshots and
revision recovery. Text fitting uses layout metrics independent of animation
transforms; arrows and vector strokes seek in both directions.

Direction is saved with scene configuration and survives DTOs, snapshots,
revision restoration, JSON import and undo. Explicit template/motion edits clear
it so the chosen editor treatment takes effect. Preview and export use the same
direction and current canvas, FPS and scene timeline. Layered titles compile
into the neutral motion graph; semantic illustrations use native vector blocks
with deterministic choreography. Text remains complete and uses measured fitting.

A layered title enters on the first available measured spoken word in its beat,
otherwise at the beat start. Word windows come from the current audible take
with matching caption provenance/FPS, including a disabled visual caption track;
stale or estimated timings are not treated as measured. The frozen direction
never invokes a provider during preview, seeking or rendering. Exported native
metrics retain the supplied value during suppressed-callback seeks.

## Bounded review and repair

The editor's **Review and fix selected layout** action measures the saved
revision, then permits at most one repair and one recapture. Eligible findings
are clipping, safe area, contrast and fallback on short text-only scenes. The
repair selects the measured layered title and preserves copy, narration, data,
assets and timing. Locked scenes, media/data scenes, long text, reading-time and
repetition findings require manual work. Semantic illustrations are not flattened
into titles by the conservative repair. Transition reviews are not repaired.
Revision and transactional scene checks reject concurrent changes with 409,
including edits during recapture. The editor refreshes from the matching saved
script; still-cache keys and source-revision hashes are distinct. Silent review
retains the current measured word windows.
The result reports passes used, zero paid calls and remaining findings. It is
not an aesthetic score or an unbounded optimization loop.

### Progressive showpiece direction

Optional `graphic.presentation` selects the bounded story-motion vocabulary;
hierarchy/system extend the same typed visual grammar. Explicit team and system
narration can upgrade an overview that was reduced to one concept. The pass
handles natural connecting/supporting clauses and removes narration connectors
from process labels while keeping every displayed phrase in the source.
Hierarchy parents must precede their children and have a supplied relationship.
Shared-region diagrams retain their overlap composition.

Showpieces and their SFX use a common schedule derived from the current beat.
Measured word text is admitted only through the existing take/FPS/provenance
checks. Prepared artifacts preserve that text and explicit effect fades;
media localization preserves narration and direction. Development validation
uses freshly loaded server/worker code so stale imports cannot stand in for the
production behavior. See [story motion](MOTION_LIBRARY.md#story-motion-showpieces).

## Verification

`node --import tsx scripts/verify-showpieces.mjs` checks all nine showpieces in
three formats and exports actual MP4s with the bundled music/effects. It samples
multiple phases, checks visible copy and container bounds, reverse seeking,
preview/producer parity and decoded audio. `--stress` verifies a three-level,
eight-actor hierarchy. `--showpiece=kinetic-handoff` targets one job;
`--preview-only` explicitly skips exports. Reports are under
`.artifacts/story-showpieces/`.

`node --import tsx scripts/verify-semantic-graphics.mjs` checks concept,
comparison and flow examples across portrait, landscape and square, including
actual isolated-worker exports, label visibility, overlap, source preservation,
forward/reverse choreography and preview/export parity. Artifacts are under
`.artifacts/content-direction/semantic-matrix/`. Its `--preview-only` option
explicitly skips exports.

`npm run test:director` runs the real deterministic/preset pipeline, offline
srcDoc and producer seeks (including backward seeking), and isolated worker
exports. Reuse installed Chrome with `PUPPETEER_EXECUTABLE_PATH` if necessary.
`--preview-only` skips exports explicitly and is not the export acceptance gate.
Artifacts and the machine-readable report are under `.artifacts/m12-director/`.

The verifier uses protocol fixtures, installed tools, zero paid calls, and no new
model downloads. Live model quality is a separate assessment. Published evidence
is in [release validation](production/RELEASE_VALIDATION.md).
