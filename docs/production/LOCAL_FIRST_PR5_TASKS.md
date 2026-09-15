# Local-first PR 5 task ledger

Scope: Tasks 16–20 only. Base:
`3a34878d25f2ad30e2950ef2fc068ae77bbe81f6` (merged PR #12). Local `main`
and `origin/main` matched and the working tree was clean before creating
`feat/local-ai-providers`. This branch is not stacked and remains local until
the user requests publication.

## Task cards

| Task | Implementation and acceptance                                                 | State    | Completion SHA                             |
| ---: | ----------------------------------------------------------------------------- | -------- | ------------------------------------------ |
|   16 | Secure local AI configuration, endpoint policy, and connectivity diagnostics  | Complete | `1558ae50771c0cd796ada6012f7591beb27715ee` |
|   17 | Shared OpenAI-compatible structured-output transport and credential isolation | Complete | `7b90005bb530cf71ab89c2af712858705f003448` |
|   18 | Ollama discovery and video/podcast planning                                   | Complete | `32ea00a46457425c0e38dbc058b254705b408e7f` |
|   19 | LM Studio discovery and video/podcast planning                                | Complete | `f96823646ac879e33548fcc9afab44a8c7902b6a` |
|   20 | Bounded JSON extraction, one repair request, and model capability guidance    | Complete | `ea109a26d9f88565ee662f6111b6dc479667fa15` |

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
  Concurrent provider updates are serialized so one save cannot overwrite the
  other provider.
- Endpoint validation resolves every hostname. It accepts loopback by default,
  requires explicit opt-in for private LAN or `host.docker.internal`, and rejects
  public/mixed answers, URL credentials, non-HTTP schemes, and redirects. Public
  media-ingestion policy is unchanged.
- Settings exposes local configuration, discovered models, token removal,
  actionable health states, connection checks, and Docker host guidance.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Focused local endpoint, secure HTTP, diagnostics, and config-store suites
  passed: 4 files, 10 tests.
- Changed-file Prettier check and `git diff --check` passed.

## Task 17 — shared OpenAI-compatible transport

Completed at `2026-09-15T18:56:17+05:30` in
`7b90005bb530cf71ab89c2af712858705f003448`.

- Extracted the compatible model-list and JSON-schema completion envelope behind
  the provider boundary. OpenAI retains its fixed origin, model filter,
  temperatures, schemas, prompts, and final Zod validation.
- The local-compatible transport can receive only the token passed by its owning
  adapter and cannot read OpenAI or Gemini keys. Local requests retain DNS and
  redirect enforcement.
- Cancellation now travels from Next.js routes through Gemini, OpenAI, and the
  compatible transport. Cloud discovery remains retryable; uncertain generation
  POSTs remain single-attempt.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Compatible transport, OpenAI regression, cloud HTTP, prompt, and schema suites
  passed: 4 files, 19 tests.
- Credential fixtures proved cloud keys do not appear in local headers or bodies.

## Task 18 — Ollama discovery and planning

Completed at `2026-09-15T19:01:26+05:30` in
`32ea00a46457425c0e38dbc058b254705b408e7f`.

- Added native `/api/tags` discovery and `/api/chat` JSON-schema planning.
  Temperature, context-window, and output-token bounds map to Ollama options.
- Video, podcast, and grounded clip plans reuse existing prompts and final Zod
  schemas. Missing or unloaded models, offline server, malformed output, schema
  mismatch, timeout, and cancellation remain distinct actionable errors.
- An absent Ollama server does not affect startup, manual workflows, or existing
  providers. Ollama becomes selectable after a model is saved.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Ollama, local HTTP, diagnostics, compatible transport, and cloud HTTP suites
  passed: 5 files, 16 tests.
- Fixtures covered discovery, video/podcast plans and every required failure
  state without a live Ollama installation.

## Task 19 — LM Studio discovery and planning

Completed at `2026-09-15T19:06:38+05:30` in
`f96823646ac879e33548fcc9afab44a8c7902b6a`.

- Added `/v1/models` discovery and `/v1/chat/completions` planning through the
  compatible transport, with a separate endpoint, optional token, diagnostics,
  and provider identity.
- Video, podcast, and grounded clip planning use existing prompts and final Zod
  schemas. Output bounds use LM Studio's compatible `max_tokens` field.
- Authentication, offline server, missing/unloaded model, timeout, cancellation,
  malformed JSON, and schema mismatch remain distinct states.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- LM Studio, Ollama, compatible transport, local diagnostics, and local HTTP
  suites passed: 5 files, 20 tests.
- Fixtures covered discovery, optional auth, video/podcast plans, required
  failures, and credential isolation without a live LM Studio server.

## Task 20 — bounded extraction, repair, and guidance

Completed at `2026-09-15T19:16:42+05:30` in
`ea109a26d9f88565ee662f6111b6dc479667fa15`.

- Accepts only one bounded complete JSON object or one explicit `json` fence.
  Prose wrappers, partial/multiple objects, arrays, oversize output, extra keys,
  missing required fields, invalid template IDs, and invalid factual data fail.
- Local output passes a strict raw Zod schema before the existing domain schema.
  The application does not synthesize fields, coerce charts, substitute template
  IDs, or accept unvalidated text.
- One observable repair POST may ask the same selected model to correct the
  rejected object while preserving valid content and facts. A second failure
  reports repair exhaustion plus small/unsupported-model guidance.

Validation:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- Structured-output, Ollama, LM Studio, endpoint, transport, diagnostics, prompt,
  schema, and config suites passed: 11 files, 48 tests.
- Fixtures verify whole/fenced input, strict unchanged validation, exactly one
  same-model repair, successful repair, exhaustion, and capability guidance.

No task used Docker, installed or started a model server, installed software,
called a real provider, changed host settings, pushed, or created a pull request.

## Gate 3 validation

Gate 3 is complete for the fixture-backed PR 5 scope:

- `npm run typecheck` and `npm run lint -- --quiet` passed.
- `npm run test:unit` passed: 69 files, 353 tests. This includes direct Gemini
  and OpenAI regressions, Ollama and LM Studio provider fixtures, endpoint and
  credential isolation, strict structured output, and a no-local-server status
  fixture that makes no network request.
- Fresh, populated, and upgraded SQLite coverage plus REST and MCP contract
  regressions passed in a focused run: 4 files, 19 tests.
- `npm run security:scan` passed with no obvious tracked secrets.
- `npm run release:check` passed all release metadata, 36 deterministic plans,
  36 capability combinations, 18 offline HyperFrames variants, and 4 bundled
  artifact probes.
- `npm run build` completed with Next.js 16.3.4 and emitted the local AI config
  route as a dynamic Node.js route.
- Every file changed by PR 5 passes Prettier and `git diff --check`. The required
  repository-wide `npm run format:check` was also run; it continues to report
  171 pre-existing files outside this branch's diff.

No Prisma schema or database migration changed. Existing projects and populated
databases keep their current format. Saving local AI settings creates the
git-ignored `.data/local-ai-config.json` version 1 file with owner-only
permissions; an absent file resolves to loopback defaults and requires no setup
or migration.
