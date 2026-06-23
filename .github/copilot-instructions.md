# Copilot Instructions

Follow `AI_GUIDELINES.md` in this repository.

Additional Copilot-specific expectations:

- Prefer edits aligned with current architecture (`src/app`, `src/library`, `src/providers`, `src/compositions`).
- Keep diffs minimal and avoid unrelated refactors.
- Never hardcode API keys or secrets.
- Keep `.env.example` documented and placeholder-only.
- Use existing components/patterns before introducing new abstractions.
- Run `npm run typecheck` and `npm run security:scan` for code-impacting changes.