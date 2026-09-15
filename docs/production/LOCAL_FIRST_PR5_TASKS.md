# Local-first PR 5 task ledger

Scope: Tasks 16–20 only. Base:
`3a34878d25f2ad30e2950ef2fc068ae77bbe81f6` (merged PR #12). Local `main`
and `origin/main` matched and the working tree was clean before creating
`feat/local-ai-providers`. This branch is not stacked and remains local until
the user requests publication.

## Task cards

| Task | Implementation and acceptance                                                 | State       | Completion SHA                             |
| ---: | ----------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
|   16 | Secure local AI configuration, endpoint policy, and connectivity diagnostics  | Complete    | `1558ae50771c0cd796ada6012f7591beb27715ee` |
|   17 | Shared OpenAI-compatible structured-output transport and credential isolation | Complete    | `7b90005bb530cf71ab89c2af712858705f003448` |
|   18 | Ollama discovery and video/podcast planning                                   | In progress | Pending                                    |
|   19 | LM Studio discovery and video/podcast planning                                | Pending     | Pending                                    |
|   20 | Bounded JSON extraction, one repair request, and model capability guidance    | Pending     | Pending                                    |

## Scope decisions

- Local AI configuration lives in a permission-restricted, git-ignored file
  separate from `.env.local`, where cloud API keys remain.
- The local endpoint policy is isolated from public media ingestion. It permits
  loopback by default, requires an explicit private-LAN opt-in, resolves every
  hostname before use, and rejects public or mixed DNS answers.
- Ollama and LM Studio remain separate provider adapters. Shared transport does
  not make a configured endpoint eligible to receive another provider's token.
- PR 5 changes planning and provider diagnostics only. Caption work, catalog
  upgrades, Quick Produce, and later REST/MCP expansion remain out of scope.

## Task 16 — local AI configuration and diagnostics

Completed at `2026-09-15T18:51:10+05:30` in
`1558ae50771c0cd796ada6012f7591beb27715ee`.

- Added separate, permission-restricted local provider configuration with
  loopback defaults, selected model, temperature, bounded context/output values,
  optional LM Studio token, endpoint scope, and persisted discovery status.
- Local endpoint validation resolves every hostname. It accepts loopback by
  default, requires explicit opt-in for private LAN or `host.docker.internal`,
  and rejects public/mixed answers, URL credentials, non-HTTP schemes, and
  redirects. The existing public media-ingestion policy is unchanged.
- Settings exposes both local providers, actionable healthy/offline/missing
  model/authentication states, connection checks, and Docker host guidance.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Focused local endpoint, secure HTTP, diagnostics, and config-store suites
  passed: 4 files, 10 tests.
- Changed-file Prettier check and `git diff --check` passed.
- No Docker command, local model installation, external provider request,
  software installation, push, or host setting change was used.

## Task 17 — shared OpenAI-compatible transport

Completed at `2026-09-15T18:56:17+05:30` in
`7b90005bb530cf71ab89c2af712858705f003448`.

- Extracted the OpenAI-compatible model-list and JSON-schema completion envelope
  behind the existing provider boundary. The OpenAI adapter retains its fixed
  cloud origin, models filter, temperatures, schemas, prompts, and final Zod
  validation.
- Added a separately constructed local-compatible transport. It can receive only
  the token passed by its owning local adapter and has no access to OpenAI or
  Gemini keys; local requests retain endpoint resolution and redirect rejection.
- Request cancellation now travels from Next.js routes through Gemini, OpenAI,
  and compatible transports. Discovery remains the only automatically retried
  cloud operation; uncertain generation POSTs remain single-attempt.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Focused compatible-transport, OpenAI regression, cloud HTTP, prompt, and schema
  suites passed: 4 files, 19 tests.
- Credential fixtures proved cloud keys do not appear in local headers or bodies,
  and that an explicitly supplied local token stays local.
- Changed-file Prettier check and `git diff --check` passed.
