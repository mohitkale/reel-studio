# Visual quality acceptance — 30 October 2026

M5 follows the merged editorial pipeline (PR #80). Its three tasks ship relevance
ranking, supplied product proof and a reproducible five-brief benchmark. The
[media guide](../MEDIA_RELEVANCE.md) and [benchmark guide](../EDITORIAL_BENCHMARK.md)
describe the current contracts and their limits.

## Verified behavior

- Metadata ranking replaces hash selection, retains score components/reasons and
  alternatives, prefers supplied media, and keeps stock licensing/materialization
  boundaries. Optional vision uses its own durable one-call allowance, bounded
  candidate list, explicit model, deadline and cancellation. HTTP fixtures cover
  the provider contract; no live vision call was made.
- Product proof maps actual supplied artifacts to features and recurring subjects.
  Preview/apply preserves copy/narration, checks locks and stale hashes, and saves
  grouped undo plus frozen provenance. Restoration remaps scene identities and
  invalidates derived storyboard caches. Later generic background changes do not
  display stale proof provenance.
- Three active-app proof examples export actual app screenshots and a labelled
  screenshot-sequence video in portrait, landscape and square. Each silent export
  is 9.9 seconds, 297 frames, 30 FPS. The recording cue is 10 seconds. Six decoded
  frames were inspected for containment, captions, supplied labels and continuity.
  [Frame comparison](../assets/visual-quality-m5/proof-frame-grid.jpg). Detailed
  checksums and reproducible command are in the media guide. No synthetic UI or
  customer outcome is presented as supplied proof.
- The production editor's supplied-proof preview was checked against the exports;
  its diff explicitly retains copy and narration and warns that the artifact is
  unverified. SQLite regressions cover undo, locks, invalid cues, deleted/unavailable
  proof, retained asset references and restored revisions.

## Local quality gates

- Full suite: **232 files, 1,159 passed, one intentionally skipped paid test**.
- Final missing-brand-mark regression: **44 affected tests passed** after frame
  inspection found the unsupplied `RS` placeholder. Closing scenes now retain
  typography without inventing a mark; supplied marks retain their existing path.
  The two affected benchmark exports were regenerated with prior outputs retained.
- The lexical specificity check exposed paired technical underscores being treated
  as Markdown emphasis. Identifier-preserving cleanup now retains `input_image`,
  `image_url` and repeated internal underscores while stripping actual emphasis.
  The final **52 affected tests passed**; only the three current-topic examples
  were recreated/exported, with the earlier rows retained as superseded evidence.
- Typecheck, full lint, secret scan, release contracts and production build passed.
- Populated published v0.3.0/v0.4.0 upgrades, backup/restore, saved media/copy/takes/
  exports/captions and isolated fresh setup passed through **20 migrations**.
- Validation scripts include the additive ranking table in current schema checks
  and remove it when reconstructing historical fixtures. Historical migration
  bytes and dependency pins are unchanged. Hot reload detects the new client model.
- Initial PR Windows CI exposed setup timeouts in two older SQLite integrations.
  Their schema is now staged in memory and backed up once before exercising the
  same real on-disk repositories. All assertions, deadlines and platform jobs are
  unchanged. Replacement latest-head Linux/Windows CI passed **233 files / 1,161
  tests**, with one intentional paid skip; merged-main Quality/Security also passed.

## Five-brief benchmark

[Checksummed record](VISUAL_QUALITY_M5_BENCHMARK.json) and
[pending human review](VISUAL_QUALITY_M5_HUMAN_REVIEW.json) cover **15 accepted
active-app exports**, five briefs × baseline/researched-app/researched-MCP, with
**154.5 seconds** total silent video. All are 1080×1920 at 30 FPS. Each app/MCP
pair has an identical MP4 checksum; every three-way comparison has identical
copy and resolved brand-token checksums. Actual output bytes were rehashed.

| Mode           | Linked scene fraction | Keyword coverage | Mean local creation | Mean export |
| -------------- | --------------------- | ---------------- | ------------------- | ----------- |
| Baseline       | 0%                    | 100%             | 51 ms               | 20.4 s      |
| Researched app | 100%                  | 100%             | 65 ms               | 40.4 s      |
| Researched MCP | 100%                  | 100%             | 460 ms              | 41.5 s      |

All cases have zero unsupported numeric tokens, repeated narration and runner
manual repair operations. These narrow measurements do not establish semantic
truth, narrative quality or visual preference. Research links are frozen imports.
Human narrative/relevance/pacing/repair ratings remain **null/pending**. The brand
fixture deliberately uses common default tokens, not an automatically inferred
brand palette; product fixtures lack supplied proof and use typography. The
separate supplied-proof matrix covers real screenshots/recording cues.

Two frames per accepted export were inspected: [product](../assets/visual-quality-m5/benchmark-product.jpg),
[technical](../assets/visual-quality-m5/benchmark-technical.jpg),
[current topic](../assets/visual-quality-m5/benchmark-current-topic.jpg),
[brand](../assets/visual-quality-m5/benchmark-brand.jpg) and
[data](../assets/visual-quality-m5/benchmark-data.jpg). The product result's complete
MP4 plays in the production app; its frozen excerpts and unverified labels are
visible. All paid writer/research/search/vision/voice calls are **zero**.

The record curates initial run `003d42e1` with current-topic refresh `5aff3eb1`.
Fifteen accepted fixture invocations plus three superseded identifier fixtures
are recorded separately (18 total); two brand exports were regenerated after
removing the unsupplied mark. Prior projects/outputs remain labelled superseded
or incomplete, with checksums retained. Superseded/incomplete benchmark projects
are archived from the default list and can be recovered. The refresh used the same registered
MCP → HTTP control path. These are targeted validation corrections, not fabricated
human repairs or additional paid calls.

Active projects are named **M5 Benchmark · {brief} · {mode} · fixture · {run}**.
Current-topic accepted projects use `5aff3eb1`; other accepted cases use `003d42e1`.
Local creation/export times are observations from these fixtures and include no
provider latency. Neither speed nor quality improvement is claimed for live models.

## Release assessment at milestone completion

Stable remains **v0.7.0**. The research/editorial/visual feature batch is a coherent
user-visible addition and warrants a future **minor release**. Publication is
deferred: benchmark human export ratings are pending, and the exact release commit
still needs the applicable fresh full render/audio/recovery matrix, platform CI,
upgrade and component-distribution gates described in [release validation](RELEASE_VALIDATION.md).
These checks are not satisfied by an older release report. No tag, version bump or
release publication is implied by milestone completion.

Subsequent v0.8.0 release validation is tracked in
[the release record](RELEASE_VALIDATION.md#v080-release-candidate--2026-10-31).

Offline fixtures demonstrate contracts and control-path parity. They do not prove
live model quality, semantic factuality, source freshness, narrated pacing or human
preference. Imported source snapshots remain external/unverified; supplied product
artifacts remain unverified. Paid writers, research/search, vision, voice and new
model downloads were not used for this acceptance.
