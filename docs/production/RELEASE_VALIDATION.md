# Release validation

Stable **[v0.4.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0)**
was published **2026-10-03** from verified `main` commit
`2081ac3edd9eab1f4dc2068c37d1f1deec06c4f1` after [PR #44](https://github.com/mohitkale/reel-studio/pull/44).
Latest-head PR checks, the isolated source build, and merged-main Quality/Security
checks passed. Later changes need fresh evidence appropriate to their scope.

## Published evidence

| Gate         | Verified result                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Install      | Clean locked install on Node 24; prebuilt local phonemizer                                                                       |
| Upgrade      | Published v0.3 schema; 14 migrations, backup/restore, fresh setup, preserved copy/media/takes/exports/captions                   |
| Quality      | Full local suite and final affected regressions, typecheck, lint, scan, contracts, build; Linux/Windows CI                       |
| Video matrix | 18 fresh H.264 exports: six presets × three formats; 606.7 seconds total; probes, brief/output hashes, inspected exported frames |
| Browser      | Prompt/result/playback/download, editor reorder/voice/export, mobile remix, MCP approval, podcast/audio/audiogram                |
| Recovery     | 210 seconds / 5,040 frames at 24 FPS; cancellation/retry and seven cached sections; identical final MP4 and decoded audio        |
| Licensing    | Pinned engine source/compiler/provenance and complete notices/source; 26 phoneme cases/eight voices in Node/offline browser      |
| Publication  | Exact tag/commit/notes; all eight assets anonymously downloaded and size/checksum verified                                       |

- [Integrated acceptance report](RELEASE_ACCEPTANCE_0.4.0.json).
- [Fresh render matrix](RELEASE_MATRIX_0.4.0.json).
- [Upgrade/rollback](../RELEASE_0.4.0.md).
- [Licensing](../LICENSING.md) and [dated advisory snapshot](../PORTABILITY_HARDENING.md#dependency-advisory-snapshot-2026-10-03).

Measurements describe one 16 GiB Intel workstation, not universal performance.
Voice protocol fixtures return labeled calibration audio: they prove jobs,
downloads, and muxing, not live-model acoustic quality. These fixtures used no
paid calls or new voice-model downloads.

## Local creation and motion audit — 2026-10-10

The unreleased `codex/creation-motion-quality` branch passed 174 test files / 876
tests, typecheck, lint, secret scan and the production build. Live browser checks
covered Gemini drafts, automatic topic themes, Quick Produce, local multi-scene
creation, reorder, scene edits/locks, playback/seeking, cached server Kokoro
narration, completed-revision recovery and MP4 export. Seven library/settings
pages also passed loading checks; these are not live-provider acceptance tests.

All 16 motion treatments passed the installed offline verifier in portrait and
landscape, including actual 57-second MP4s, forward/backward seeking, native
preview/export parity, supplied data, brand propagation and text-fit checks.
Full-HD wellness, product and data examples were exported and their frames
inspected. The wellness export included real cached Kokoro narration.

Automatic direction selects a curated coherent theme and compatible scene
treatments; it does not promise a unique generated design for every request.
Generated copy requires review: a live data draft used inaccurate percent-change
wording despite correct chart values. The QA copy was corrected in the editor,
and prompt guidance was tightened. Unconfigured third-party voice/media paths
and fresh model downloads were not accepted as working based on these checks.
New release publication still requires merged-main platform CI and the remaining
release gates below.

## Local motion-family audit — 2026-10-12

The unreleased `codex/creation-motion-quality` branch passed 175 test files / 884
tests, typecheck, lint, secret scan and the production build. Seven additional
native treatments bring the library to 23. New production drafts save a coherent
Editorial, Graphic or Precision family; compatibility, repeat avoidance, frozen
choices, append behaviour, locks and revision restoration have regression coverage.

All 23 treatments passed the offline verifier in portrait, landscape and square,
including three actual 78-second MP4s (234 seconds total). Checks cover light/dark
palettes, dense inputs, text bounds, effective opacity, overlap, forward/reverse
seeking and native preview/producer parity. The seven new treatments also passed
21 early-versus-settled exported-frame comparisons. Their exported frames were
visually inspected in each format. The checks caught and resolved a CSS namespace
collision and dense square-list spacing issues before acceptance.

Browser checks covered the live gallery, automatic family selection on a new
local draft, family selection on an existing AI-generated draft, compatible
treatment choices and supplied-list editing after changing the base template.
A real editor export completed through the background worker at 1080 × 1920,
13.5 seconds; its supplied tile-grid items matched the preview. This audit made
no new AI/voice-provider calls or model downloads. It does not replace the earlier
live-provider checks or the remaining release gates. The additional compositions
and gallery illustration are original app code/assets; no registry source or
additional dependencies were installed. Reports, hashes and screenshots remain
in ignored local verification artifacts.

The feature batch remains unreleased until merged-main platform CI and the
applicable release gates pass; the stable release is still v0.4.0.

## Local content-direction audit — 2026-10-13

The unreleased `feature/content-relevant-motion-system` branch adds automatic
concept, comparison, qualitative overlap and process illustrations. Subject
definitions are reused across the story and appended scenes; labels, symbol
meaning and source quotations are revalidated against current copy. Existing
media, data, custom visuals, overrides and locks remain authoritative. The
Create with AI controls were also aligned and measured in the live browser.

The final local suite passed 179 files / 896 tests, including real SQLite
creation/restoration, provider-schema compatibility, current source admission,
append continuity and export preparation/localization. Typecheck, lint,
secret scan and the production build passed. All 23 existing treatments passed
preview checks in three formats;
their prior exported matrix remains historical evidence.

Eight semantic scenes passed portrait, landscape and square checks, including
three actual 48-second isolated-worker MP4s (144 seconds total). The verifier
checks complete copy, reading size, opacity, bounds, overlap, vector animation,
reverse seeking and preview/producer parity. Exported frames were inspected in
each format, with separate examples for discovery, answers, synthesis, plants,
code and ordered production steps.

Live browser testing used the bare idea “SEO vs AEO vs GEO” and automatic
direction. Three Gemini drafts succeeded; a fourth request returned provider
HTTP 503. No automatic paid retry was made. Earlier drafts exposed inaccurate
acronym expansions and repetitive prose; the prompt now supplies Google's
published search terminology for this particular bare-idea comparison. Other
topics are not automatically researched, and relevance guards do not establish
general factual accuracy.

The seven-scene acceptance draft was locally replanned with its model-generated
copy and narration unchanged. Full-reel and isolated previews showed distinct
subjects and shared foundations. A real editor export exposed lost narration
context in two production boundaries; both were fixed and the durable
preparation contract advanced. A recovered job and a fresh editor export then
completed at 1080 × 1920, 30 FPS, 53 seconds. Decoded frames matched across all
five illustrated scenes, and early/settled frames confirmed animation. These
exports had no narrated voice take; no voice-model download or voice-provider
call was used in this audit. The original user project remains unchanged.

Artwork and choreography are original app code. No registry assets, new
dependencies or models were installed. Reports, probes, hashes and screenshots
remain in ignored local artifacts. This feature batch still requires merged-main
platform CI and applicable release gates; stable remains v0.4.0.

## Before the next release

Follow [release policy](../../AI_GUIDELINES.md#release-policy). Release a coherent
batch of user-visible changes or a significant fix; docs-only maintenance joins
the next release. Preserve licensing and compatibility gates.

```bash
npm ci
npm run test:unit -- --maxWorkers=2
npm run typecheck
npm run lint
npm run security:scan
npm run test:phonemizer
npm run test:release-upgrade
npm run release:check
npm run build
```

Also verify current browser workflows, actual audiogram/voice paths, and isolated
worker cancellation. For a feature release affecting integrated video behavior:

```bash
npm run release:matrix
npm run test:video-sections -- --long --cancel
```

Use installed tools. New model downloads/paid calls need authorization. An urgent
scoped patch still needs full code/platform/build/licensing gates; document the
real scenarios proving its fix and whether an unchanged broad matrix can be reused.

`release:check` validates version/lock metadata, exact pins, migrations,
retired-engine absence, component provenance, documentation, six presets,
three briefs, 18 offline compositions, and bundled gallery decoding. Update the
checker and evidence together when versions/contracts change. The real matrix
performs **18**, not 36, HyperFrames exports.

Before distributing the speech engine, run
`node scripts/check-phonemizer-provenance.mjs --distribution` with the matching
source archive. Rebuild the compiler only for relevant source/toolchain/provenance
changes; ordinary PR compatibility tests use the prebuilt engine. After publication,
verify tag target, notes, anonymous downloads, and checksums. Never overwrite a
published release/tag.

## Historical measurements

Earlier dual-engine/36-output runs and expansion gates are in the
[validation archive](../archive/production/RELEASE_VALIDATION.md) and
[archive index](../archive/README.md). They cannot satisfy a changed current contract.
