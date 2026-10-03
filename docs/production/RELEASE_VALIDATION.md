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
