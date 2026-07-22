# Security Policy

## Supported Versions

This project is in active local-first development. The default branch is the only supported line for security updates.

## Reporting a Vulnerability

Please do not open a public issue for sensitive security reports.

1. Contact the maintainer privately.
2. Include reproduction steps, impact, and affected files.
3. If possible, include a minimal patch suggestion.

## Secret Handling Rules

- Never commit real secrets, tokens, or private keys.
- Keep runtime keys in .env.local only.
- .env.example must contain placeholders only.
- Use npm run security:scan before creating commits.

## Pre-Commit Secret Scan

Local git hooks live in `.githooks/` (`pre-commit` + `commit-msg`).

Enable once per clone:

- `npm run prepare:hooks` (sets `git config core.hooksPath .githooks`)

Then each commit will:

- run `npm run security:scan` and block commits that appear to contain secrets
- strip Cursor / cursoragent `Co-authored-by` trailers from the commit message

## Scope

The scanner checks tracked files for common secret signatures (API key patterns and private key headers). It is a guardrail, not a guarantee.
