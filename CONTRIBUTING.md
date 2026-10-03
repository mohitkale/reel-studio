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
versioned database migrations. See [setup](docs/SETUP.md) for Docker, runtime
checks, and troubleshooting. Never use `db:push` to upgrade an existing database.

## Make a focused PR

1. Create a branch: `git switch -c feature/your-change`.
2. Follow [AI_GUIDELINES.md](AI_GUIDELINES.md) and existing architecture.
3. Add or adjust meaningful checks for behavior that changed.
4. Update the owning guide when setup, behavior, or APIs change.
5. Run the relevant local checks below, inspect your diff, and scan for secrets.
6. Push to your fork and open a PR with the problem, resulting behavior, and validation.

Maintainers merge after required checks pass on the latest PR commit. Agent-led
milestones follow the complete branch → PR → CI → merge → refreshed-main cycle
in [AI_GUIDELINES.md](AI_GUIDELINES.md#milestone-pr-workflow).

## Verify in proportion to the change

| Change                                            | Local checks                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Documentation only                                | Markdown formatting, links/anchors, commands and screenshots; secret scan                                                 |
| Ordinary code change                              | Affected behavior tests, typecheck, relevant lint, secret scan                                                            |
| Rendering, security, jobs, database, dependencies | Broader tests plus relevant real export, browser, migration, or cancellation checks                                       |
| Release                                           | Full install/upgrade/platform/browser/render/license gates in [release validation](docs/production/RELEASE_VALIDATION.md) |

```bash
# Focus a test run on the behavior you changed
npm run test:unit -- tests/your-feature.test.ts --maxWorkers=2
npm run typecheck
npm run lint
npm run security:scan

# Broad local unit/integration gate when the change warrants it
npm run test:unit -- --maxWorkers=2
```

You do not need the entire suite after every edit. Keep external providers mocked
unless live usage is explicitly authorized. Real exports are required for visual
changes; string/snapshot tests alone cannot prove readability or motion.

**Current CI:** every PR update and push to `main` runs full Linux/Windows
Quality checks and Security scanning, including documentation-only PRs. Local
scope does not bypass those configured gates. Full video matrices are manual;
phonemizer source rebuilds are limited to relevant paths or manual requests.
See [verification and release policy](AI_GUIDELINES.md#verification-policy).

## Architecture and extensions

- Pages and API handlers: `src/app/` and `src/server/`.
- Repositories, media storage, render orchestration: `src/library/`.
- Shared production schemas and workers: `src/production/`.
- HyperFrames HTML, templates, and motion renderers: `src/engines/hyperframes/`.
- Engine-neutral scene/timing/motion contracts: `src/video/`.
- AI, voice, and stock providers: `src/providers/`.

HyperFrames is the sole video engine. Read [architecture](docs/ARCHITECTURE.md),
[template authoring](docs/TEMPLATE_AUTHORING.md), and
[provider/block registration](docs/EXTENSIONS.md) before extending them.
Do not reintroduce removed Remotion folders or accept executable AI compositions.

## Security and licenses

- Keep keys and tokens out of code, Markdown, screenshots, recordings, and fixtures.
- `.env.example` contains placeholders; `.env.local` and user data stay ignored.
- Enable the staged secret-scan hook with `npm run prepare:hooks`.
- Report vulnerabilities according to [SECURITY.md](SECURITY.md).
- Document provenance, redistribution rights, and required notices for added assets/dependencies.
- Contributions use the application's MIT license; third-party terms stay distinct.
  See [licensing](docs/LICENSING.md).

## Attribution and releases

Add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md) with your merged contribution.
Credit only the people and agents involved. Preserve author/co-author metadata
when merging; do not rewrite released history to add attribution.

Maintainers assess a release after a coherent batch of changes, usually 3–5
user-facing PRs, or sooner for a significant bug/security fix. Documentation-only
maintenance joins the next release. Details and standing maintainer authorization
are in [release policy](AI_GUIDELINES.md#release-policy).

For an issue, include reproduction steps, expected/actual behavior, OS, Node
version, and redacted logs or screenshots. Feature requests should explain a
creator use case and a concrete example input/output.
