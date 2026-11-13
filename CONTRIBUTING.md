# Contributing to Reel Studio

Help build a useful local video and podcast studio. Bug fixes, readable docs,
new motion treatments, provider integrations, performance improvements, and
reproducible fixtures are welcome. Follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Start developing

Fork the repository, then clone your fork. Use Node 24 LTS (minimum 24.15),
FFmpeg/FFprobe, and an installed Chrome/Chromium browser:

```bash
git clone https://github.com/YOUR-USERNAME/reel-studio.git
cd reel-studio
nvm use
npm ci
npm run setup
npm run dev
```

Open `http://localhost:3000`. Setup preserves existing configuration and uses
versioned database migrations. See [setup](docs/archive/guides/SETUP.md) for Docker, runtime
checks, and troubleshooting. Never use `db:push` to upgrade an existing database.

## Branches and PRs

`main` is the only long-lived branch and is always releasable.

- Branch from fresh `main` and name the branch after its issue:
  `feature/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/<issue>-<slug>` or
  `docs/<issue>-<slug>`. Do not use tool or agent names as prefixes.
- One issue, one branch, one PR. Start the PR body with `Closes #<issue>` and
  tick each **Done when** line from the issue with its evidence.
- PRs are squash-merged and the branch is deleted automatically on merge.
  Never push to `main` directly.
- Releases are tags on `main` (`vX.Y.Z`). There are no release branches unless
  a patch must skip unreleased work.
- Work is planned in [GitHub milestones](https://github.com/mohitkale/reel-studio/milestones).
  Take the lowest-numbered open `agent-ready` issue in the earliest open
  milestone whose dependencies are closed.

### Labels

| Label                                 | Meaning                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `area:*`                              | Part of the product: engine, storyboard, mcp, studio, audio, ci, docs, repo |
| `priority:p0` / `p1` / `p2`           | Blocks the milestone / needed for it / nice to have                         |
| `size:S` / `M` / `L`                  | Under half a day / one to two days / several days                           |
| `agent-ready`                         | Fully specified; anyone can pick it up                                      |
| `needs-decision`                      | Waits for a maintainer decision                                             |
| `tracking`                            | Roadmap or milestone overview                                               |
| `bug`, `enhancement`, `documentation` | Reports and requests from the issue forms                                   |
| `good first issue`, `help wanted`     | Good entry points for new contributors                                      |

Before opening the PR: add or adjust checks for behavior that changed, update
the owning guide when setup, behavior, or APIs change, run the relevant local
checks below, inspect your diff, and scan for secrets. Contributors without
write access push to a fork and open the PR from there.

## Verify in proportion to the change

| Change                                            | Local checks                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation only                                | Markdown formatting, links/anchors, commands and screenshots; secret scan                                                               |
| Ordinary code change                              | Affected behavior tests, typecheck, relevant lint, secret scan                                                                          |
| Rendering, security, jobs, database, dependencies | Broader tests plus relevant real export, browser, migration, or cancellation checks                                                     |
| Release                                           | Full install/upgrade/platform/browser/render/license gates in [release validation](docs/archive/release-evidence/RELEASE_VALIDATION.md) |

```bash
# Fast unit tests: no database, filesystem, FFmpeg or child processes
npm run test:unit
npm run test:unit -- src/video/motion-spec.test.ts

# Integration tests (*.int.test.ts): SQLite, filesystem, FFmpeg, workers
npm run test:int -- --maxWorkers=2
npm run test:int -- src/library/production-jobs.int.test.ts

npm run typecheck
npm run lint
npm run security:scan
```

A test that opens a database, writes files, or starts a process is an
integration test and is named `*.int.test.ts`. Unit tests run in the Node
environment; start a file with `// @vitest-environment jsdom` when it needs a DOM.

You do not need the entire suite after every edit. Keep external providers mocked
unless live usage is explicitly authorized. Real exports are required for visual
changes; string/snapshot tests alone cannot prove readability or motion.

**CI:** every PR runs a fast Linux gate (secret scan, typecheck, lint, unit
tests; documentation-only PRs skip the code steps). The full Linux and Windows
gate with integration tests and a build runs on `main`, nightly, and on PRs
that touch risky paths or carry the `ci:full` label. Full video matrices are
manual. See [agent rules](AGENTS.md#before-pushing).

## Architecture and extensions

- Pages and API handlers: `src/app/` and `src/server/`.
- Repositories, media storage, render orchestration: `src/library/`.
- Shared production schemas and workers: `src/production/`.
- HyperFrames HTML, templates, and motion renderers: `src/engines/hyperframes/`.
- Engine-neutral scene/timing/motion contracts: `src/video/`.
- AI, voice, and stock providers: `src/providers/`.

HyperFrames is the sole video engine. Read [architecture](docs/ARCHITECTURE.md)
and [contributing scenes](docs/CONTRIBUTING_SCENES.md) before extending it.
Do not reintroduce removed Remotion folders or accept executable AI compositions.

## Security and licenses

- Keep keys and tokens out of code, Markdown, screenshots, recordings, and fixtures.
- `.env.example` contains placeholders; `.env.local` and user data stay ignored.
- Enable the staged secret-scan hook with `npm run prepare:hooks`.
- Report vulnerabilities according to [SECURITY.md](SECURITY.md).
- Document provenance, redistribution rights, and required notices for added assets/dependencies.
- Contributions use the application's MIT license; third-party terms stay distinct.
  See [licensing](docs/LICENSING.md).

## Releases (pre-1.0)

- One release per closed milestone. A patch release is fine for a user-facing fix.
  Documentation, refactors and small maintenance wait for the next release.
- Cut a release with one command, one PR merge and one tag:

  ```bash
  npm run release -- minor --dry-run   # preview the version bump and changelog
  npm run release -- minor             # bump, changelog, open the release PR
  npm run release -- tag               # after the PR merged: tag main and push
  ```

  The changelog section is built from merged PR titles grouped by the PR's
  `area:*` label, so copy the issue's `area:*` label onto the PR. Add the
  `breaking` label to a PR that changes the storyboard or an API incompatibly.

- Pushing the tag starts `.github/workflows/release.yml`: full gate on Linux and
  Windows, the render smoke test, the phonemizer corresponding-source build, then
  the GitHub release with notes and the source archive attached. No manual upload.
- Upgrade notes appear only when a database migration or a breaking storyboard
  change ships; the script adds them for migrations. No per-release validation
  documents or acceptance JSON. `npm run db:migrate` backups and
  `npm run test:release-upgrade` stay.
- Publishing to npm and announcements need the maintainer's explicit go-ahead.

Add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md) with your merged contribution.
Credit only the people and agents involved. Preserve author/co-author metadata
when merging; do not rewrite released history to add attribution.

For an issue, include reproduction steps, expected/actual behavior, OS, Node
version, and redacted logs or screenshots. Feature requests should explain a
creator use case and a concrete example input/output.
