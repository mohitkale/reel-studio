# Copilot Instructions

Follow `AI_GUIDELINES.md` in this repository.

Additional Copilot-specific expectations:

- Prefer edits aligned with current architecture (`src/app`, `src/library`,
  `src/production`, `src/providers`, `src/video`, `src/engines/hyperframes`).
- Keep diffs minimal and avoid unrelated refactors.
- Never hardcode API keys or secrets.
- Keep `.env.example` documented and placeholder-only.
- Use existing components/patterns before introducing new abstractions.
- Follow the scope-based verification, attribution, and release policies in
  `AI_GUIDELINES.md`; run typecheck and secret scanning for code-impacting changes.
