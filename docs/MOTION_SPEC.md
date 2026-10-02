# Motion spec and compiler prototype — M10

The version-1 contract in `src/video/motion-spec.ts` is independent of the
render framework. A spec has an FPS and ordered, nonoverlapping shots, each with
frame timing, ordered layers and elements. Text and rectangle/ellipse elements
use normalized canvas boxes and saved brand color tokens. Transform/opacity
tracks use explicit frame/value keyframes and one of four bounded easing choices.
IDs are unique throughout the graph. Zod rejects unsupported versions, duplicate
orders/properties, invalid boxes and out-of-window or unordered keys. No arbitrary
HTML, CSS, JavaScript, selectors, URLs or generated chart numbers enter this schema.

`ReelProps.motionSpec` is an optional prototype input to the existing HyperFrames
compiler. It must match the saved scenes, beats and FPS exactly. Graph visuals
join the existing paused root timeline; narration, music, captions and cover
offsets retain their existing timing. Keyframes are local to each shot, with the
first value held before its frame and the last value held after its frame.
Motion between keys remains active for its authored duration. Layer order defines
stacking; text inherits the project's real offline font. Text size/boxes are
explicit in this prototype; automatic graph text fitting and an editor for graph
geometry are not claimed here.

`migrateLegacyMotion` references each original scene without rewriting storage.
`legacyMotionRoundTrip` requires those original scenes and clones every field,
including media, emphasis, items, chart data and existing direction. Missing or
mismatched references fail. A legacy spec produces the same HTML as the existing
scene path; authored graphs cannot be flattened into legacy scenes. Existing
projects need no database migration. The prototype is a compiler input rather
than a persisted editor/API format; authored recipes and director integration
belong to the following milestones.

Run `node --import tsx scripts/verify-motion-spec.mjs` with an installed browser
(`REEL_VERIFY_CHROME` optionally selects it). It blocks external requests and
compares offline srcDoc preview with callback-suppressed producer seeks, including
backward seeks, final reading holds, continuous shape motion and copy overflow.
It then exports actual portrait and landscape MP4s through the isolated worker,
checks dimensions/duration, and extracts exported keyframes for inspection.
Evidence is ignored under `.artifacts/m10-motion-spec/`; `--preview-only` skips
MP4 export and must not be recorded as complete render evidence.

Verified 2026-10-03: full local repository suite (808 tests, including audiogram
export), typecheck/lint/secret scan/release checks and production build passed;
the final five focused schema/compiler cases also passed. Offline preview and
producer seeks agree on element poses, clip visibility and handoffs, including
backward seeks. Actual mixed graph/legacy exports are five seconds at 30 FPS;
portrait 540×960 and landscape 960×540 settled and handoff keyframes were inspected.
The report records MP4 probes and SHA-256 values. Final fixture export hashes:

- Portrait: `6be4f60770a622d7d536e643b4e742313e311587e367e23df077341fdb2aac68`
- Landscape: `935bdfb300e08441339641389b56cc982feee44293846d378e7e3dc0a152347a`

The owning PR still requires its latest-head Linux/Windows CI before merge.
