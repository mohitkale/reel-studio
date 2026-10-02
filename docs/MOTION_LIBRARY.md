# Authored motion library — M11

The first reviewed library has fifteen treatments. It builds on the existing
native HyperFrames compiler and preserves saved scene direction/version values.
The new **Word stack** reveals one to eight supplied words in sequence; copy
that exceeds its eight-word/80-character budget falls back without truncation.
The existing inspector lists the new treatment from the same typed catalog.

| Family        | Treatments                           | Required source inputs                              |
| ------------- | ------------------------------------ | --------------------------------------------------- |
| Kinetic type  | Word stack, Impact, Editorial        | Complete supplied copy                              |
| Data          | Spotlight, Comparison bars           | Matching supplied labels/values; source retained    |
| Diagrams      | Path, Orbit                          | Two–five supplied ideas; Orbit needs at least three |
| Product/media | Product frame, Cinematic cover       | Supplied image/video and copy                       |
| Comparisons   | Split comparison, Stacked comparison | Exactly two supplied labels                         |
| Quiet reading | Quiet divider, Quiet center          | Supplied copy                                       |
| Brand         | Brand lockup, Brand frame            | Supplied copy and optional saved wordmark           |

All treatments now inherit the saved brand background, ink, muted color,
accents and real offline font. Shared spacing/radius tokens preserve the safe
area contract. The stage clips the composition; authored headline glyphs can
paint through their individual reveal-line boxes so the real font's ascenders
and descenders are complete. Data labels remain the supplied endpoint values;
an orbit/bar reveal does not invent a statistic or substitute a counter value.

A shared ambient motif uses finite, duration-derived timelines. It remains
active during long reading holds without moving the copy. Scene handoffs use
the shared M9 overlapping tail/root timeline. Authored treatments add a full-bleed
background child outside the fading wrapper so incoming/outgoing headlines do
not show through each other during the reveal. The library remains deliberately
small; adding dozens of look-alike blocks is outside this milestone.

## Reproduce acceptance

Run `npm run test:motion-library` (or `node --import tsx
scripts/verify-motion-library.mjs`) with an installed browser. Optionally set
`REEL_VERIFY_CHROME` to its executable. The fixture creates a deterministic,
MIT product UI image; chart values are explicitly synthetic supplied data.
No account, paid provider, new model or remote media is required.

The verifier checks all fifteen blocks in portrait and landscape, including dark
and light brand kits. It checks complete supplied copy, text ranges against real
clipping ancestors/stage bounds, saved ink, data values, external/failed requests,
preview/producer seek parity and backward seeks during a twelve-second reading
hold. It writes review contact sheets and then renders actual 54-second 24 FPS
MP4s through the isolated worker, probes dimensions/duration, hashes each export,
and extracts every block plus handoff/long-hold frames. Outputs and logs are
ignored under `.artifacts/m11-motion-library/`. `--preview-only` does not satisfy
the export gate and its report explicitly records that exports were skipped.

These are verified fixture/copy budgets, not a promise that arbitrary supplied
media, arbitrary fonts or unlimited copy fit every treatment. Existing fallback
reasons remain visible and preserve content. M12 owns content-aware shot planning;
M13 owns the broader creation/timeline UX.

Verified 2026-10-03: full local suite (811 tests including real audiogram export),
release checks and production build passed. Final typecheck/lint/secret scan and
40 focused compiler/library cases passed. Dark/light contact sheets and all
fifteen blocks' actual exported frames were reviewed in both orientations;
54-second MP4 dimensions/duration, handoffs and long-hold frames were inspected.
The final report records media/MP4 probes and hashes:

- Portrait 540×960: `4d5515e218fbc692a0b19fe8fa29a13f18aba20391530da4ce88f4fe4035cc4e`
- Landscape 960×540: `cda0ce9714cb9fe36d520cd732d732011ce8e046ee51a9a354140fc41aa90f88`

The owning PR still requires successful latest-head Linux/Windows checks.
