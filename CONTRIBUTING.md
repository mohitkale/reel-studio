# Contributing

Thanks for contributing to Reel Studio.

## Development Setup

1. Install dependencies:
- npm install

2. Copy environment template:
- cp .env.example .env.local

3. Initialize database:
- npm run db:push

4. Optional sample data:
- npm run seed:demo-brandkit
- npm run seed:assets

5. Run app:
- npm run dev

## Code Quality Checklist

Before opening a PR:

- npm run lint
- npm run typecheck
- npm run test
- npm run security:scan

## Security Requirements

- Never commit .env.local.
- Never hardcode API keys in source files or docs.
- Keep .env.example values empty or placeholder-only.
- If a secret is exposed, rotate it immediately.

## Local Git Hook (Recommended)

Enable the provided pre-commit hook once per clone:

- git config core.hooksPath .githooks

The hook runs npm run security:scan before each commit.

## Commit Guidance

- Keep commits focused and atomic.
- Prefer clear commit messages explaining why a change is needed.
- Add or update tests when behavior changes.

## Architecture Notes

- Voice providers are pluggable via src/providers/voice.
- AI providers are isolated under src/providers/ai.
- Render orchestration lives in src/library/render-service.ts.
- API routes should validate inputs with Zod.
