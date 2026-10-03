# Director pipeline

Reel Studio uses content-aware direction to the existing no-key planner and the same
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
Optional version-1 shot direction chooses an authored treatment or a bounded
text/shape layered title, plus an admitted existing motion recipe. Media,
charts, lists and long text retain authored treatments. Invalid, unknown or
executable direction fields fail schema validation. Local and frontier providers
use the same admission rules. OpenAI's strict JSON schema makes optional fields
required and nullable as specified by its
[structured-output contract](https://developers.openai.com/api/docs/guides/structured-outputs).

Selecting a cloud planner authorizes its one initial call. The project API also
accepts `directorBudget: { maxPaidCalls: 0 | 1 }`; explicit zero rejects a cloud
planner before credential access or invocation. No-key planning and layout
repair use zero paid calls. Planning does not automatically replay paid work.

## Frozen direction and current timing

Direction is saved with scene configuration and survives DTOs, snapshots,
revision restoration, JSON import and undo. Explicit template/motion edits clear
it so the chosen editor treatment takes effect. Preview and export compile the
same scene direction into the neutral motion graph using the current
canvas, FPS and scene timeline. Text remains complete and uses measured fitting.

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
repetition findings require manual work. Transition reviews are not repaired.
Revision and transactional scene checks reject concurrent changes with 409,
including edits during recapture. The editor refreshes from the matching saved
script; still-cache keys and source-revision hashes are distinct. Silent review
retains the current measured word windows.
The result reports passes used, zero paid calls and remaining findings. It is
not an aesthetic score or an unbounded optimization loop.

## Verification

`npm run test:director` runs the real deterministic/preset pipeline, offline
srcDoc and producer seeks (including backward seeking), and isolated worker
exports. Reuse installed Chrome with `PUPPETEER_EXECUTABLE_PATH` if necessary.
`--preview-only` skips exports explicitly and is not the export acceptance gate.
Artifacts and the machine-readable report are under `.artifacts/m12-director/`.

The verifier uses protocol fixtures, installed tools, zero paid calls, and no new
model downloads. Live model quality is a separate assessment. Published evidence
is in [release validation](production/RELEASE_VALIDATION.md).
