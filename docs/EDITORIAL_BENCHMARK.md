# Editorial and visual benchmark

`editorial-visual-v1` freezes five briefs: product, technical explainer, current-topic
research, fictional brand and synthetic data. Each compares the legacy direct
baseline, source-linked editorial in-app service and MCP storyboard/review path.
The fixtures and measurable rubric live in `src/production/editorial-benchmark.ts`.

## Offline acceptance

Start the normal local app with its existing MCP token, finish other jobs, then run:

```bash
BENCHMARK_URL=http://127.0.0.1:3000 npm run benchmark:editorial -- --save-examples --render
```

This intentionally creates fifteen named projects in the **active app database**
and uses the existing isolated worker for fifteen silent portrait exports. No
writer, research, vision or voice provider is called; no model is downloaded.
Omit `--render` for saved examples only. It refuses active unrelated jobs. Keep the
app's normal authentication; the existing MCP token is read locally and never
printed. It is passed only to the selected loopback app.

All three modes use identical fixture copy, supplied facts and explicit null brand
kit selection. Resolved brand-token and copy checksums must match. This isolates
provenance, local compilation, guards and rendering; it does **not** demonstrate
model-quality improvement. Research uses frozen imported source snapshots marked
external/unverified. The dated current-topic brief is the [official OpenAI image-input guidance](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses) checked on 30 October 2026, not a continuously refreshed news test.
Product/technical facts describe repository contracts; brand/data are synthetic.

Writing is seeded through the shared library for repeatable fixture injection.
MCP acceptance then uses the installed SDK's linked client/server transports and
the actual registered tools over authenticated HTTP for status, compile, apply and
review. No mocked HTTP is used. This proves those control-path boundaries, not an
end-to-end provider dispatch through MCP creation. Existing route/contract tests
cover creation, permissions, quotas and cancellation separately.

The local manifest records every project/script/job, export checksum, dimensions,
frame count, duration, creation/export latency, source title, findings and metrics.
Two decoded frames per export support visual inspection. Reservations are written
before dispatch. Runs have unique directories and never resume or retry spent work
automatically; failed runs remain labelled failed with their partial evidence.

## What the metrics mean

| Dimension        | Observable measurement and limit                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factual support  | Fraction of scenes with current narration and valid source/excerpt links; unsupported numeric tokens listed. Neither verifies semantic truth.                                |
| Specificity      | Fraction of frozen brief keywords present in copy/narration. This is a lexical check, not a writing-quality score.                                                           |
| Narrative        | Repeated narration count and existing filler/payoff review findings; human narrative score stays null.                                                                       |
| Visual relevance | Supplied proof scene count; semantic relevance stays null until a reviewer checks actual artifacts and frames.                                                               |
| Pacing           | Actual MP4 duration/frame count plus estimated speech timing. Silent fixtures do not establish narrated pacing.                                                              |
| Cost/latency     | Actual paid calls separately from fixture invocations, local stage/export wall times. Offline currency cost is zero; live currency cost is unknown without verified billing. |
| Manual edits     | Runner repair operations separately from human repair count, which remains null until review.                                                                                |

## Opt-in live writer comparison

No live calls are required for normal tests. To intentionally spend up to fifteen
writer calls (one per example), choose an already configured provider/model:

```bash
BENCHMARK_URL=http://127.0.0.1:3000 npm run benchmark:editorial -- \
  --save-examples --render --paid --provider=openai --model=YOUR_WRITER_MODEL \
  --max-writer-calls=15
```

The selected model must support the existing structured writer contract. Baseline
gets the same supplied facts as the editorial variants. Each call has a bounded
deadline and disables repair/retry; all editorial stages have a one-call budget.
Research/search, vision and voice budgets remain zero. This option tests live
writing with frozen evidence, not search freshness or voice quality. Check current
provider capabilities and terms before opting in. A new invocation is a new
explicit budget; it does not reclaim failed reservations from an earlier run.

## Human export review and release acceptance

Each rendered run emits `human-review.json` with **pending** ratings. A reviewer
must watch complete exports and check actual sources and product proof, caption
legibility, continuity and pacing. Record factual support, specificity, narrative,
visual relevance and pacing (1–5), the human repair count, reviewer and notes.
Accept only after needed repairs; agent frame inspection is recorded separately.

```bash
npm run benchmark:editorial -- --review-file=PATH/human-review.json \
  --manifest=PATH/manifest.json
```

Validation requires all fifteen accepted reviews, complete ratings, distinct
script IDs and checksums matching both the same run and the current MP4 bytes. It validates the submitted record;
it cannot authenticate who performed a review or establish factual truth. Pending
or partial ratings never pass. Keep manifests and their reviewed exports together.

See [M5 acceptance evidence](production/VISUAL_QUALITY_M5_VALIDATION.md) and the
[release gates](production/RELEASE_VALIDATION.md). CI, component provenance,
upgrade/recovery, relevant full render/audio matrix and required human acceptance
remain release gates; this benchmark does not replace them.
