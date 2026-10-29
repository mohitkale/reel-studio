# Research and evidence

Research is separate from scene generation. Evidence schema version 1 retains
source IDs, public URLs (nullable for pasted text), titles, retrieval/publication
dates, excerpts, linked claims, conflicts, gaps and provenance. Validation rejects
duplicate IDs and dangling or cross-source references. Citations describe where a
claim came from; they do not guarantee truth. Provider citation segments are
generated answer text, explicitly distinct from quotes fetched from a page.

## Capabilities

The research allowlist is independent of model discovery and the writer model.

| Provider/model                    | Native search | URL context | Supplied sources | Shared backend |
| --------------------------------- | ------------- | ----------- | ---------------- | -------------- |
| Gemini 2.5 Flash, Flash-Lite, Pro | Yes           | Yes         | Yes              | No             |
| Other Gemini models               | No            | No          | Yes              | No             |
| OpenAI                            | No            | No          | Yes              | No             |
| Ollama, LM Studio, llama.cpp      | No            | No          | Yes              | No             |

Supported Gemini combinations use the Developer API `v1beta/models:generateContent`
endpoint. Model support was checked against Google's [Search grounding](https://ai.google.dev/gemini-api/docs/google-search),
[URL context](https://ai.google.dev/gemini-api/docs/url-context), and
[REST reference](https://ai.google.dev/api/generate-content) on 2026-10-29.
Only Gemini 2.5 is enabled: search is billed per grounded prompt; newer models
bill per query without a hard query-count cap in this adapter. Model listing is
not evidence of tool compatibility. There is no automatic provider fallback.

Budgets distinguish provider calls from search charge units (`grounded_prompt`),
observed search queries and tokens. No budget implies no paid calls. Preserve
required citations and search-suggestion attribution whenever displaying native
research. Provider HTML and all retrieved text are untrusted data, never app
instructions or HTML to inject into the application DOM.
