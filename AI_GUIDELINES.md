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
- `src/library`: repositories, render services, storage
- `src/providers`: provider integrations (voice + AI)
- `src/compositions`: Remotion composition and templates

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

## Required Checks Before Finalizing

Run relevant checks when code changes are made:

- `npm run typecheck`
- `npm run lint` (if lint-sensitive changes were made)
- `npm run test` (when behavior changes)
- `npm run security:scan`

## Rendering and Performance Notes

- Rendering is CPU-heavy; prefer backend tuning over random UI workarounds.
- Keep render queue/progress behavior stable.
- Do not degrade output correctness for speed without explicit user approval.

## Documentation Rules

- Update `README.md` when setup, scripts, env vars, or architecture expectations change.
- Keep docs concise and actionable.
- Avoid private paths, personal identifiers, or proprietary references.

## Agent Behavior

- If uncertain, inspect existing code patterns first.
- Explain tradeoffs clearly when making non-trivial choices.
- If blocked by missing information, ask the smallest possible clarification.