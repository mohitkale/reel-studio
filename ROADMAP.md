# Roadmap

Current stable release: **[v0.4.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0)**.
This roadmap separates released features from proposals; future items are not promises.

## Shipped

- Prompt-first Generate → result → download, scene editing, and remix.
- HyperFrames-only preview/export; six presets, sixteen authored motion treatments,
  and portrait, landscape, and square layouts.
- Deterministic, source-grounded direction plus optional constrained AI planning.
- Local/cloud voice options, editable styled captions, and reusable narration.
- Podcasts with turn reuse, finishing controls, transcripts, chapters, and audiograms.
- Durable jobs/batches, cancellation/retry/recovery, scoped REST/MCP automation,
  chapter authoring, and section-cached chapter exports.
- Node 24 upgrades, Linux/Windows CI, safe database upgrades, bundled fonts/runtime,
  media hardening, and verified speech-engine source/licensing.

See [CHANGELOG.md](CHANGELOG.md) for release history and
[release validation](docs/production/RELEASE_VALIDATION.md) for v0.4.0 evidence.

## Next candidates

- Easier structured-data entry for charts and comparisons.
- More distinct, curated motion treatments with readable three-format fixtures.
- Clearer optional transcription/model setup and diagnostics.
- Faster warm renders and better resource feedback on modest computers.
- Streamlined CI triggers, stale-run cancellation, and shorter artifact retention.
- More accessible editor controls and contributor examples.

Choose a concrete creator use case before starting one of these items. Typed
provider/block registration already exists; broader plugin discovery and
packaging remain possible future work.

## Longer-term exploration

- Desktop packaging after the local web workflow is stable.
- Additional production formats backed by trustworthy supplied media.
- Local scheduling with explicit resource/provider budgets.
- Collaboration, cloud sync, or distributed rendering with a designed authentication
  and isolation model.

Propose an idea through [GitHub Issues](https://github.com/mohitkale/reel-studio/issues)
with example inputs and outputs. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for implementation.
