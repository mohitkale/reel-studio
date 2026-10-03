# Documentation

Reel Studio **v0.4.0** uses HyperFrames for preview, export, and audiograms.
Start with the guides below. Completed milestone plans are historical, not the
current setup instructions or a pending to-do list.

## Use Reel Studio

- [Setup and troubleshooting](SETUP.md): Node, browser, FFmpeg, Docker, and upgrades.
- [Creator guide](CREATOR_GUIDE.md): presets, narration, captions, podcasts, and batches.
- [Walkthroughs](WALKTHROUGHS.md): reproducible text-to-video and podcast flows.
- [Advanced editing](ADVANCED_EDITING.md): motion review, sound, chapters, and longer exports.
- [Local-first behavior](LOCAL_FIRST.md): local data and optional outbound provider calls.
- [Voice providers](VOICE_PROVIDERS.md): browser, local server, and cloud capabilities.
- [Upgrade to v0.4.0](RELEASE_0.4.0.md): backups, migrations, and rollback.
- [MCP guide](../mcp/README.md): scoped agent automation and examples.

## Develop and operate

- [Contributing](../CONTRIBUTING.md) and [AI guidelines](../AI_GUIDELINES.md): checks, PRs, attribution, and release cadence.
- [Architecture](ARCHITECTURE.md) and [runtime/recovery](RUNTIME.md).
- [Production contracts](production/CONTRACTS.md): shared REST/MCP/revision contracts.
- [Template authoring](TEMPLATE_AUTHORING.md) and [provider/block extensions](EXTENSIONS.md).
- [Motion spec](MOTION_SPEC.md), [authored library](MOTION_LIBRARY.md), and [director pipeline](DIRECTOR_PIPELINE.md).
- [Export fidelity](EXPORT_FIDELITY.md), [bounded IO](IO_RECOVERY.md), and [voice timing](VOICE_RESILIENCE.md).
- [Creation UX](CREATION_UX.md) and [demo capture](DEMO_CAPTURE.md).
- [Release validation](production/RELEASE_VALIDATION.md): checks and published evidence.

## Policies and history

- [Security](../SECURITY.md), [hardening and advisory snapshot](PORTABILITY_HARDENING.md), and [licensing](LICENSING.md).
- [Changelog](../CHANGELOG.md), [roadmap](../ROADMAP.md), and [contributors](../CONTRIBUTORS.md).
- [Historical archive](archive/README.md): earlier briefs, audits, numbered plans, and measurements.

Keep one canonical guide per topic. Update the owning guide when behavior changes;
archive completed plans and retain checksummed release evidence without turning
current guides into task transcripts.
