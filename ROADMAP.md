# Roadmap

Current release: **[v0.8.0](https://github.com/mohitkale/reel-studio/releases/tag/v0.8.0)**.
This roadmap separates released features from proposals; future items are not promises.

## Shipped

- Prompt-first Generate → result → download, scene editing, and remix.
- HyperFrames-only preview/export; six presets, 23 authored motion treatments,
  and portrait, landscape, and square layouts.
- Deterministic, source-grounded direction plus optional constrained AI planning.
- Local/cloud voice options, editable styled captions, and reusable narration.
- AI-first creation, content-matched palettes and motion families, nine story
  showpieces with event-timed sound, and preserved scene locks/media/revisions.
- Podcasts with turn reuse, finishing controls, transcripts, chapters, and audiograms.
- Durable jobs/batches, cancellation/retry/recovery, scoped REST/MCP automation,
  chapter authoring, and section-cached chapter exports.
- Node 24 upgrades, Linux/Windows CI, safe database upgrades, bundled fonts/runtime,
  media hardening, and verified speech-engine source/licensing.

v0.7.0 also ships a responsive creator hub, dedicated voiceovers,
waveform editing with saved takes/history, reviewed language versions, local
recording/transcription, structured chart grids and frozen-asset protection.
These studio improvements are included in the current release.

See [CHANGELOG.md](CHANGELOG.md) for release history and
[release validation](docs/production/RELEASE_VALIDATION.md) for release evidence.

## Next candidates

v0.8.0 adds the research/editorial/visual-quality feature batch. See the
[benchmark and acceptance record](docs/EDITORIAL_BENCHMARK.md) and
[release validation](docs/production/RELEASE_VALIDATION.md).

- More distinct, curated motion treatments with readable three-format fixtures.
- Clearer optional transcription/model setup and diagnostics.
- Faster warm renders and better resource feedback on modest computers.
- Streamlined CI triggers, stale-run cancellation, and shorter artifact retention.
- More contributor examples and accessibility coverage.

Choose a concrete creator use case before starting one of these items. Typed
provider/block registration already exists; broader plugin discovery and
packaging remain possible future work.

No next feature milestone is currently committed; these are proposals for a
future release rather than prerequisites for v0.8.0.

## Longer-term exploration

- Desktop packaging after the local web workflow is stable.
- Additional production formats backed by trustworthy supplied media.
- Local scheduling with explicit resource/provider budgets.
- Collaboration, cloud sync, or distributed rendering with a designed authentication
  and isolation model.

Propose an idea through [GitHub Issues](https://github.com/mohitkale/reel-studio/issues)
with example inputs and outputs. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for implementation.
