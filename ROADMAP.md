# Roadmap

Reel Studio develops as a local content-production tool. This roadmap separates
released work from ideas that still need design and validation.

## Shipped in 0.4

- A guided no-key production path from source content to verified output
- Six versioned production presets for both HyperFrames and Remotion
- Portrait, landscape, and square layouts that reflow at the scene level
- Durable video, audio, podcast, audiogram, and batch production jobs
- Editable captions, optional local transcription, centralized audio mixing, and
  selective voice or podcast-turn regeneration
- Scoped REST and MCP automation with explicit provider and usage limits
- Safe database upgrades, local diagnostics, gallery examples, and release matrix

See [the changelog](CHANGELOG.md) and
[release validation](docs/production/RELEASE_VALIDATION.md) for the exact
behavior and evidence.

## Motion graphics branch

- Eight authored treatments across type, supplied data, diagrams and media in
  both engines, with seeded direction, ambition, scene locks and visible fallbacks
- Native scene sheets, selected-scene samples, phone view and transition strips
- Peak-aligned sound accents, narration protection, editable music beat maps and
  optional measured final audio mastering
- Full-source chapter drafts, outline editing and chapter-scoped AI rewriting
- Controlled five-minute chapter production, resumable sections and continuous
  audio; Remotion reuses sections unaffected by visual edits

The exact shipped behavior and remaining motion scope are in
[the motion plan](docs/production/MOTION_GRAPHICS_PLAN.md).

## Next

- A richer structured-data form for charts and comparisons
- More curated, versioned HyperFrames catalog treatments for the six presets
- Guided whisper.cpp installation and model diagnostics on supported platforms
- Faster warm renders through more persistent browser and bundle reuse
- Additional caption styling and accessible contrast controls
- More contributor fixtures and template validation helpers

## Later

- Optional plugin architecture for templates and providers
- Desktop packaging after the local web release is stable
- Additional production formats where users can supply trustworthy source media
- Deeper automation scheduling with explicit local resource controls

## Exploratory

These are research directions rather than scheduled promises:

- Real-time collaboration and cloud sync
- Distributed rendering
- Native mobile companion apps
- Real-time voice conversion
- Deep 3D model import pipelines

Discuss proposals in
[GitHub Discussions](https://github.com/mohitkale/reel-studio/discussions) or
follow [CONTRIBUTING.md](CONTRIBUTING.md) with a concrete use case and fixture.
