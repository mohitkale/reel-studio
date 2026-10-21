# Adaptive baseline and review rubric

M0 is a retrospective baseline against published v0.5.0, executed after M1–M6.
It records the upgrade's behavior rather than claiming a study happened before
implementation. The retained [upgrade plan](../ADAPTIVE_CONTENT_FACTORY_PLAN.md)
is historical context; [adaptive contracts](../ADAPTIVE_CONTRACTS.md) describe
current behavior.

## Fixed corpus and reproduction

[The frozen corpus](../../tests/fixtures/adaptive-baseline.json) contains twelve
four-scene briefs: two for each production preset, balanced across portrait,
landscape and square, sparse/dense copy, text-only/supplied local media, and
English/Hindi/Hinglish. Two cases have explicit chapters; process/list subjects
return in the recap. Supplied chart values and their attribution are explicit.
Precision, Clean Story, Calm, a fixed seed and identical silent timing rules keep
the comparison controlled. This is not a test of AI writing or speech quality.

Run `node --import tsx scripts/verify-adaptive-baseline.ts` from the repository
with installed dependencies, FFmpeg/FFprobe and Chrome available. It backs up
the active SQLite database, extracts the published v0.5.0 source into an ignored
working directory, verifies historical compiler/planner source bytes and lockfile
parity, and uses installed dependencies without an install. The same runner invokes
each version's own planner, repositories, compiler and isolated renderer. It saves
clearly named **M0** projects, timing takes and exports in the active app. Existing
source projects and historical releases are retained.

The runner checks persisted copy, list labels, chart data, supplied-media presence,
output dimensions, duration and frame rate before recording output hashes and a
midpoint frame from each scene. Reruns reconnect to these verifier-owned examples
and retain completed work. Local `.artifacts/adaptive-m0/` contains source records,
per-film inputs and output reports. Do not reuse that directory after deliberately
changing the frozen corpus; pass `--output-root=.artifacts/adaptive-m0-new` for a separate artifact directory.

## Capability inventory

| Capability        | v0.5.0                                                                | M1–M6 candidate                                                                         |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Rendering         | Isolated local HyperFrames, six presets, three canvases               | Same pinned runtime and exports                                                         |
| Motion vocabulary | Authored type/data/diagram/media treatments and nine story showpieces | Retained, plus six versioned adaptive recipes                                           |
| Layout            | Authored template/treatment rules                                     | Explicit density, timing and aspect resolution with declared fallbacks                  |
| Film direction    | Seeded local variation and literal subject colouring                  | Bounded sequence search, saved subject registry, aliases and narrow shared-card handoff |
| Editing           | Saved scenes, media, narration, captions and locks                    | Film-plan checkpoints, scoped variation/undo, contact sheet and animatic                |
| Long form         | Bounded chapters                                                      | Explicit lesson policy, chapter goals and callback context; verified up to ten minutes  |
| Reuse             | Durable jobs, batches and cached sections                             | Versioned series profiles, aspect/cutdown lineage and pinned data/asset packs           |

Normal video remains capped at three minutes, chaptered video at five, and an
explicit lesson at ten. Storyboards remain bounded at 240 scenes. Cutdowns select
complete scenes, up to twenty and three minutes; they do not rewrite narration.
[Factory limits](../FACTORY_WORKFLOWS.md) bound each run and retained metadata.
No arbitrary executable pack uploads, unbounded duration expansion or general
motion-graph editor is implied.

Hindi samples are visual text checks on the named macOS reference machine.
The frozen font bundle has no dedicated Devanagari face; glyphs use the host's
fallback. These results do not certify portable Hindi font coverage or Hindi
narration quality. Hinglish cases use Latin text. The separate release matrix
checks bundled fonts and captions in English across all preset/canvas pairs.

## Review rubric and failure categories

Review every sampled scene and the opening, transitions and recap in the saved
film. Score each dimension independently on a 1–5 scale: 1 means unusable,
3 means understandable with noticeable limitations, and 5 means clear and deliberate.

- **Relevance:** the visual explains supplied meaning and uses legal inputs.
- **Readability:** copy, chart labels and subtitles fit and remain readable.
- **Rhythm:** time matches copy density; reveals leave reading time.
- **Continuity:** recurring subjects retain labels, identity and useful context.
- **Visual craft:** hierarchy, spacing, colour and motion support the explanation.

Hard failures override a pleasing score: lost source copy/data/assets or broken
locks; fabricated values; unexplained clipping or unsafe subtitles; invalid timing;
preview/seek divergence; nondeterministic saved decisions; failed recovery or
unexpected provider traffic. Categorize them as source, layout, media/font,
timing/seek, continuity, recovery, or resource failures and record the affected case.

A verifier preflight initially used inadmissible inline SVG media. That caused
scene-config fallback and was caught by the chart-preservation assertion. The
accepted run uses a schema-admitted local PNG and explicitly checks persisted
media presence. A browser parity check also caught the deliberate SVG download-only policy; the accepted asset is PNG, and that policy stays intact. Those preliminary outputs remain labeled preflight and do not
count as accepted corpus outputs. Application source was not changed for that
verifier correction.

The plan's 80% repair-free and 70% blind-preference figures are proposed product
targets. Agent visual inspection is not a blind human preference study. Keep those
ratings unmeasured until independent people score randomized, unlabeled pairs;
report participants, sample size and rubric when that study is performed.

## Completed comparison

The accepted run produced **24 H.264 MP4s**, twelve per source version, and
**96 decoded scene midpoint frames**. Persisted copy, item labels, chart values
and attribution match the frozen inputs. The PNG asset survives persistence in
all six supplied-media cases. At 30 FPS the pinned producer can retain one extra
terminal frame; probes enforce a one-frame tolerance and matching duration.
[Checksummed output records](ADAPTIVE_M0_BASELINE.json) identify every accepted
render, source-content hash and reference machine. These are retained active-app
examples; elapsed verification time is not a fresh rendering benchmark.

All twelve paired sheets were inspected: **v0.5.0 above, current below**, scenes
1–4 left to right. The current process arrangements preserve recurring labels and
order; media arrangements keep their full source copy. Historical m0-02 clips the
last lines of its dense landscape explanation. Current m0-08 initially lost its
image in the native Data Story chart fallback; a narrowly scoped renderer fix,
three orientation regressions and a regenerated MP4 verify the image, 18/11 values
and attribution together. Dense captions and chart attribution remain small at
contact-sheet scale; review full-size exports for delivery.

| Preset              | Sparse comparison                                  | Dense/media comparison                             |
| ------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Product Launch      | [m0-01](../assets/adaptive-m0/m0-01.jpg)           | [m0-02](../assets/adaptive-m0/m0-02.jpg)           |
| Editorial Explainer | [m0-03](../assets/adaptive-m0/m0-03.jpg)           | [m0-04, Hindi](../assets/adaptive-m0/m0-04.jpg)    |
| Creator Punch       | [m0-05, Hinglish](../assets/adaptive-m0/m0-05.jpg) | [m0-06](../assets/adaptive-m0/m0-06.jpg)           |
| Data Story          | [m0-07](../assets/adaptive-m0/m0-07.jpg)           | [m0-08](../assets/adaptive-m0/m0-08.jpg)           |
| Developer Demo      | [m0-09](../assets/adaptive-m0/m0-09.jpg)           | [m0-10, Hinglish](../assets/adaptive-m0/m0-10.jpg) |
| Cinematic Brand     | [m0-11](../assets/adaptive-m0/m0-11.jpg)           | [m0-12, Hindi](../assets/adaptive-m0/m0-12.jpg)    |

The [dense preview capture](../assets/adaptive-m0/dense-preview.png) shows the
saved landscape example at its media beat. Browser checks cover full-reel
playback and forward/reverse seek against the same exported source.
