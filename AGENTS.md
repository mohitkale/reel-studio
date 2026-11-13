<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent rules (single source for every coding agent)

`CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `DEVIN.md` and `.github/copilot-instructions.md` only point here. An explicit request in chat outranks this file.

## Product

Reel Studio is a local-first content factory for short videos and podcasts. **An LLM may only write the storyboard JSON.** Voice (Kokoro), scenes, motion (HyperFrames), captions, audio and MP4 export stay local and deterministic. Automation is the default, manual editing stays available, and no existing feature is removed or hidden without a maintainer decision recorded in an issue (inventory: `docs/FEATURES.md`, guarded by `npm run test:parity`). A PR that removes or hides a row there says so in its title and links the decision; a new page, route or MCP tool adds a row.

## Architecture boundaries

- `src/app`, `src/server`: pages and API routes. `src/library`: repositories, storage, render orchestration.
- `src/engines/hyperframes`: templates and HTML builders. `src/providers`: voice and AI providers. `src/production`: shared schemas and workers.
- `src/video`: engine-neutral scene, timing and design contracts; no framework imports.
- `src/storyboard`: Storyboard v1, the one public contract an LLM writes (`schemas/storyboard.v1.json` is generated; `npm run storyboard:schema`).
- MP4 export runs only through `src/library/hyperframes-render.ts` and `scripts/hyperframes-render-worker.mjs`.
- Strict TypeScript, no unjustified `any`, Zod for API input and external IO. Keep diffs small; no unrelated reformatting or renames.

## Picking up an issue

1. Roadmap: issue #140. Take the lowest-numbered open `agent-ready` issue in the earliest open milestone whose dependencies are closed. `needs-decision` issues wait for the maintainer.
2. Comment that work has started. One issue = one branch = one PR.
3. Confirm the file paths named in the issue against the code before editing.

## Branches and PRs

- `main` is the only long-lived branch. Branch from fresh `main` as `feature|fix|chore|docs/<issue>-<slug>`; never name branches after a tool or agent; never push to `main`.
- The PR body starts with `Closes #<issue>` and ticks each **Done when** line with real evidence (command output, measurement, link). Say plainly what is not done.
- Wait for the `gate` check, squash-merge, delete the branch, `git pull --ff-only` on `main`, then start the next issue. Add the `ci:full` label when behavior could differ on Windows or the change touches `prisma/`, `scripts/`, `src/library/`, `src/server/`, `vendor/`, workflows or package manifests.
- Fix failed checks on the same branch. Respect required reviews; report blockers instead of working around them.

## Before pushing

Run what matches the change, not everything every time:

- Docs only: `npx prettier --check` on changed files, links and commands, `npm run security:scan`.
- Code: `npm run typecheck`, `npm run lint`, `npm run test:unit` (or a file path), `npm run security:scan`.
- Integration (`*.int.test.ts`: SQLite, filesystem, FFmpeg, workers): `npm run test:int -- --maxWorkers=2`.
- Rendering, security, jobs, database, dependencies: also run the real export, browser, migration or cancellation scenario.
- Adding or changing a page, route or MCP tool: update `docs/FEATURES.md`, run `npm run test:parity`.
- Add regression tests for changed behavior; keep paid providers and model downloads opt-in, use fixtures.

## Visual changes

Judge them by actual exported frames, never by string or snapshot tests. Attach a contact sheet of real frames (synthetic demo content only) to the PR.

## Secrets and environment

- Never commit keys, tokens, `.env.local` values, private media or personal paths. `.env.example` holds placeholders. `npm run security:scan` must pass.
- Node 24 LTS (minimum 24.15), FFmpeg and Chrome are required. Ask before installing software, changing machine settings or deleting data; reuse installed tools.
- Ask the maintainer before renaming the repo, publishing to npm, or posting publicly.

## Docs and releases

- Update the owning guide and `README.md` when setup, scripts, env vars or behavior change; keep one canonical guide per topic (`docs/README.md`).
- Releases are `vX.Y.Z` tags on a verified `main` commit, cut with `npm run release` (see `CONTRIBUTING.md`); notes come from merged PR titles. Copy the issue's `area:*` label onto the PR so they group. No per-milestone validation documents or acceptance JSON.

## Attribution

Keep the maintainer as Git author. Add a `Co-Authored-By` trailer only for the agent that did the work, and never strip it:

- Claude: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Codex: `Co-authored-by: Codex <codex@openai.com>`
- Cursor: `Co-authored-by: Cursor <cursoragent@cursor.com>`
