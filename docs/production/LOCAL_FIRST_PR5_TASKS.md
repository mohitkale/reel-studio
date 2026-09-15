# Local-first PR 5 task ledger

Scope: Tasks 16–20 only. Base:
`3a34878d25f2ad30e2950ef2fc068ae77bbe81f6` (merged PR #12). Local `main`
and `origin/main` matched and the working tree was clean before creating
`feat/local-ai-providers`. This branch is not stacked and remains local until
the user requests publication.

## Task cards

| Task | Implementation and acceptance                                                 | State       | Completion SHA |
| ---: | ----------------------------------------------------------------------------- | ----------- | -------------- |
|   16 | Secure local AI configuration, endpoint policy, and connectivity diagnostics  | In progress | Pending        |
|   17 | Shared OpenAI-compatible structured-output transport and credential isolation | Pending     | Pending        |
|   18 | Ollama discovery and video/podcast planning                                   | Pending     | Pending        |
|   19 | LM Studio discovery and video/podcast planning                                | Pending     | Pending        |
|   20 | Bounded JSON extraction, one repair request, and model capability guidance    | Pending     | Pending        |

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
