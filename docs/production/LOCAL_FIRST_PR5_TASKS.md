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
|   18 | Ollama discovery and video/podcast planning                                   | Complete    | `32ea00a46457425c0e38dbc058b254705b408e7f` |
|   19 | LM Studio discovery and video/podcast planning                                | Complete    | `f96823646ac879e33548fcc9afab44a8c7902b6a` |
|   20 | Bounded JSON extraction, one repair request, and model capability guidance    | In progress | Pending                                    |

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

## Task 19 — LM Studio discovery and planning

Completed at `2026-09-15T19:06:38+05:30` in
`f96823646ac879e33548fcc9afab44a8c7902b6a`.

- Added LM Studio `/v1/models` discovery and `/v1/chat/completions` planning
  through the shared OpenAI-compatible transport, while retaining its own
  endpoint, optional local token, diagnostics, and provider identity.
- Video, podcast, and grounded clip planning use the existing prompts and final
  Zod schemas. Output bounds use LM Studio's compatible `max_tokens` field.
- Authentication failures, offline server, missing or unloaded model, timeout,
  cancellation, malformed JSON, and schema mismatch are reported separately.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Focused LM Studio, Ollama, compatible-transport, local diagnostic, and local
  HTTP suites passed: 5 files, 20 tests.
- Fixtures covered `/v1/models`, optional auth, video/podcast plans, all required
  failure states, and credential isolation without a live LM Studio server.

## Task 18 — Ollama discovery and planning

Completed at `2026-09-15T19:01:26+05:30` in
`32ea00a46457425c0e38dbc058b254705b408e7f`.

- Added Ollama to the provider registry with native `/api/tags` discovery and
  `/api/chat` JSON-schema planning. Selected temperature, context window, and
  output-token bounds map to Ollama generation options.
- Video, podcast, and grounded podcast-clip plans use existing prompts and final
  Zod schemas. Missing/uninstalled models, runner-load failures, offline server,
  malformed output, schema mismatch, timeout, and cancellation remain distinct
  actionable errors.
- Ollama server absence does not affect startup, manual workflows, or existing
  Gemini/OpenAI selection. Its provider status becomes selectable only after a
  model is saved.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Focused Ollama, local HTTP, diagnostics, compatible-transport, and cloud HTTP
  suites passed: 5 files, 16 tests.
- Fixtures covered discovery, video planning, podcast planning, offline server,
  missing and unloaded models, timeout, cancellation, malformed JSON, and schema
  mismatch without a live Ollama installation.
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
