# AI Guidelines (Cross-IDE)

This file is the canonical instruction set for AI assistants in this repository.
Keep changes minimal, high-quality, and consistent with existing architecture.

## Project Intent

- Next.js app for short-form video creation and rendering.
- Local-first workflow, strict TypeScript, repository-layer architecture.
- Security first: never introduce hardcoded secrets.

## Non-Negotiables

1. Preserve architecture boundaries:

- `src/app`: pages + API route handlers
- `src/library`: repositories, render orchestration, storage
- `src/engines`: HyperFrames catalog and HTML builders
- `src/providers`: provider integrations (voice + AI)
- `src/video`: shared scene, timing and design contracts; no framework-specific imports
- HyperFrames MP4 export: `src/library/hyperframes-render.ts` + `scripts/hyperframes-render-worker.mjs`

2. Keep strict typing and avoid unsafe shortcuts:

- No `any` unless clearly justified.
- Use Zod validation for API inputs and external IO.

3. Do not leak secrets:

- Never commit `.env.local` values.
- Keep `.env.example` placeholders only.
- Respect `npm run security:scan` failures.

4. Favor small, focused diffs:

- Do not reformat unrelated files.
- Do not rename symbols/files unless necessary.

5. Honor current visual and UX style:

- Reuse existing components before creating new ones.
- Preserve established UI patterns.

## Verification Policy

Choose local checks by the behavior and risk of the change. Do not rerun the
entire suite after every small edit or repeat passing checks without a new reason.

| Change                                            | Local verification                                                                                         | PR gate                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Documentation only                                | Markdown formatting, local links/anchors, command accuracy, current screenshots, secret scan               | Configured checks on latest head        |
| Ordinary code                                     | Affected behavior tests, typecheck, relevant lint, secret scan                                             | Full configured Quality/Security checks |
| Rendering, security, jobs, database, dependencies | Broader tests and relevant actual exports/browser/migration/cancellation scenarios                         | Linux/Windows checks and builds         |
| Release                                           | Clean install/upgrade, full checks, browser workflows, actual render matrix, recovery, licenses and assets | Verified exact release commit           |

Use `npm run test:unit -- tests/<affected>.test.ts --maxWorkers=2` for focused
tests and `npm run test:unit -- --maxWorkers=2` for broader local runs. Add
meaningful regression coverage; avoid tests that simply mirror implementation.
Visual changes require actual exported frames and preview/export inspection.
Keep paid providers and new model downloads opt-in; use fixtures where possible.

Current Quality/Security workflows still run full checks on every PR update and
push to `main`, including docs. The expensive render matrix is manual, and the
phonemizer source build is path-filtered/manual. This policy does not skip or
weaken existing required CI. Any workflow optimization needs its own reviewed
change that preserves required-check behavior. Do not rerun the source compiler
for unrelated changes. Avoid simultaneous heavy test/render workloads locally.

See [release validation](docs/production/RELEASE_VALIDATION.md) for release gates.

## Rendering and Performance Notes

- Rendering is CPU-heavy; prefer backend tuning over random UI workarounds.
- Keep render queue/progress behavior stable.
- Render only with the isolated HyperFrames worker. Preserve legacy project content through template migration.
- Reel Studio requires Node 24 LTS, minimum 24.15; local http(s) media must be copied into the render project as relative assets (producer blocks remote downloads of localhost URLs).
- Do not degrade output correctness for speed without explicit user approval.
- ElevenLabs free/Starter rejects `wav_44100`; fallback + resample lives in `src/providers/voice/elevenlabs.ts` and `normalizeWavToTarget` in `src/lib/wav.ts`.

## Documentation Rules

- Update `README.md` when setup, scripts, env vars, or architecture expectations change.
- Keep docs concise and actionable.
- Avoid private paths, personal identifiers, or proprietary references.
- Use [docs/README.md](docs/README.md) as the index and keep one canonical guide
  per topic. Current guides describe shipped behavior, not milestone transcripts.
- Archive completed plans/audits with an explicit historical label; preserve
  compatibility fixtures, license notices, and checksummed release evidence.
- Validate links after moving documents. Keep README focused on the demo,
  benefits, setup, and contribution paths; put operational detail in the guides.

## Agent Behavior

- If uncertain, inspect existing code patterns first.
- Explain tradeoffs clearly when making non-trivial choices.
- If blocked by missing information, ask the smallest possible clarification.

## Milestone PR Workflow

For user-requested milestone implementation, complete each milestone before
starting the next: create a `feature/` branch from updated `main`, implement and
validate, commit and push, open one focused PR, wait for required CI/build checks
on its latest head, merge, switch locally to `main`, and pull with `--ff-only`.
Verify the merge is present before creating the next branch. Opening a PR alone
does not complete a milestone. Fix failed checks on that same branch; respect
required reviews and branch protection. Do not advance with an unmerged PR or
implicitly stack milestones.

The user has requested this complete cycle; do not repeatedly ask for merge
permission within the authorized task. Explicit draft-only, do-not-merge, pause,
or alternative workflow requests take precedence. Preserve unrelated work, and
report concrete blockers when the cycle cannot continue.

## Commit Attribution

Keep the maintainer's Git author/committer identity and append a co-author trailer
only for the agent(s) actually involved:

- Codex: `Co-authored-by: Codex <codex@openai.com>`.
- Cursor: `Co-authored-by: Cursor <cursoragent@cursor.com>`.

Do not suppress or strip these trailers. This explicit project preference
overrides earlier no-AI-attribution rules. Preserve trailers in squash/merge
messages, verify the final commit on `main`, and do not rewrite published history
or change global Git identity. Contributors documentation supplements commit
credit; it does not populate GitHub's Contributors view by itself.

## Release Policy

The maintainer authorizes agents completing repository work to assess and publish
appropriate GitHub releases without asking for the same release permission again.
Explicit pause, draft-only, do-not-release, or other user constraints take priority.

- Assess unreleased changes after roughly 3–5 user-facing PRs or completion of
  a coherent feature set. Release based on user value/readiness, not PR count alone.
- A significant standalone bug/security fix can justify an earlier patch release.
- Documentation, attribution, refactors without user-visible behavior, and small
  maintenance join the next release; do not release after every PR or manufacture
  changes to meet a count. No timer/scheduled automation is implied.
- At task completion, compare `main` against the latest stable tag and report
  whether a release is due or the changes are accumulating for the next one.
- Choose patch/minor/major versions by compatibility and scope. Synchronize
  package/lock metadata, changelog, upgrade notes, scripts and affected guides.
- Before publishing, pass the relevant full release gates, latest-head platform
  CI/builds, safe upgrade/rollback, actual exports, and component licensing gates.
- Tag the exact merged, refreshed, verified `main` commit. Never overwrite a
  published release/tag. Publish meaningful notes and verify downloadable assets
  and checksums; include matching corresponding source when GPL components ship.
- Keep provider usage/downloads within existing authorization. Missing provenance,
  incompatible terms, failing gates, or required reviews block publication.

## Environment changes

- Ask for explicit permission before installing software, changing computer-level
  settings, or performing destructive actions.
- Reuse installed tools. If Docker Desktop is stopped, ask the user to start it.
- Explain downloads and dependency installation inside a Docker test image and
  obtain permission before starting that build.
