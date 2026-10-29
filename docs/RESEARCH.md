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
| OpenAI GPT-4.1 Mini, GPT-4.1      | Yes           | No          | Yes              | No             |
| Other OpenAI models               | No            | No          | Yes              | No             |
| Ollama, LM Studio, llama.cpp      | No            | No          | Yes              | Yes            |

Supported Gemini combinations use the Developer API `v1beta/models:generateContent`
endpoint. Model support was checked against Google's [Search grounding](https://ai.google.dev/gemini-api/docs/google-search),
[URL context](https://ai.google.dev/gemini-api/docs/url-context), and
[REST reference](https://ai.google.dev/api/generate-content) on 2026-10-29.
Within Gemini, only version 2.5 is enabled: search is billed per grounded prompt; newer models
bill per query without a hard query-count cap in this adapter. Model listing is
not evidence of tool compatibility. There is no automatic provider fallback.

OpenAI research uses `OPENAI_API_KEY` and `v1/responses` with `web_search`, separately from the existing
Chat Completions writer. Its allowlist is GPT-4.1 Mini (research default) and
GPT-4.1, checked against the official [web-search guide](https://developers.openai.com/api/docs/guides/tools-web-search)
and [Responses reference](https://developers.openai.com/api/reference/cli/resources/beta/subresources/responses/methods/create)
on 2026-10-29. One provider call and one `web_search_call` charge allowance are
required; `max_tool_calls: 1` bounds hosted tool use. Returned citations, consulted
sources and token usage are normalized into the same evidence contract. Missing
source lists/citations remain explicit gaps. Visible, clickable source citations
are required when displaying OpenAI research. URL-context requests require Gemini
or supplied-source capture. No live paid calls are part of normal validation.

Budgets distinguish provider calls from search charge units (`grounded_prompt` or `web_search_call`),
observed search queries and tokens. No budget implies no paid calls. Preserve
required citations and search-suggestion attribution whenever displaying native
research. Provider HTML and all retrieved text are untrusted data, never app
instructions or HTML to inject into the application DOM.

## Persistence and recovery

Run `npm run db:migrate` after upgrading, with the production worker stopped.
The additive migration preserves existing projects. Evidence revisions are
append-only through the repository; a refresh produces a new revision. Cache
entries expire after six hours. Their keys include the evidence version, query,
mode, sources, researcher/model and output limit. Refresh requires a new
idempotency key; reusing a key always reconnects to its original job, even after
expiry or failure. Reusing a key with changed inputs returns a conflict.

Identical concurrent requests share a durable job. A database claim permits only
one execution. Provider usage is reserved before outbound IO; failed, canceled
or interrupted calls retain that allowance because billing may be uncertain.
Deadline-expired work fails without automatic replay. An explicit new refresh
is needed to retry. Cancellation stops the running request and prevents late
evidence publication. Cached jobs report zero new usage; the original evidence
retains the usage that produced it. Partial/empty results retain explicit gaps.

## Gemini setup and validation

Set `GEMINI_API_KEY` in Settings or the local environment. Research uses the same
key as scene generation but a separately selected model (default:
`gemini-2.5-flash`). The adapter issues one bounded POST with Google Search and,
when URLs are supplied, URL context. It does not retry paid POSTs or request scene
JSON. Public URL validation precedes the provider request. Unknown models and
missing credentials fail before a call is reserved.

The evidence includes original grounding/URL metadata, the provider's search
suggestion HTML, search queries and reported token counts. Citation offsets are
validated as UTF-8 byte offsets against the original text part. Unsupported,
empty, ungrounded and partial results expose gaps. Successful URL retrieval
alone does not create a supported claim. Conflicts are not independently inferred
or verified by this adapter; that limitation is included in each result.

Normal tests use offline fixtures. For an explicitly authorized paid smoke only,
set `REEL_LIVE_RESEARCH=1` and `REEL_LIVE_GEMINI_KEY` in the environment, then run
`npm run test:unit -- src/providers/research/gemini.test.ts --maxWorkers=2`.
The smoke makes one call; it does not assert that a provider will always search.

## Authenticated API

The creation dialog can research supplied text, a public URL, or the web before
planning a draft or Quick Produce. It requires an AI writer when research is
selected. The saved evidence revision is included in the project and frozen
production snapshots. Web research is an explicit, separately budgeted call.
The existing same-origin/loopback policy applies; strict mode requires bearer
authentication. Named tokens need `studio:write` for submission/cancellation and
`studio:read` for capability, status and evidence inspection. Cloud research also
requires the selected researcher in both provider allowlists and an available paid-request slot.
That slot is reserved only by the winning worker immediately before its call.
There is no additional approval gate and no implicit provider fallback.

| Method and path                      | Result                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `GET /api/research/capabilities`     | Curated support, configuration flag and limits; no keys                      |
| `POST /api/research/jobs`            | Submit or reconnect by idempotency key; 202 pending / 200 cached or complete |
| `GET /api/research/jobs/:id`         | Status, timestamps, redacted error, usage, evidence ID; no outbound research |
| `POST /api/research/jobs/:id/cancel` | Cancel queued/running work; completed evidence stays immutable               |
| `GET /api/research/evidence/:id`     | Frozen evidence pack including source excerpts and attribution               |

Example web-research body (one provider call plus one grounded-prompt allowance):

```json
{
  "idempotencyKey": "research-example-001",
  "mode": "web",
  "providerId": "gemini",
  "modelId": "gemini-2.5-flash",
  "query": "What does the latest official Node.js LTS policy say?",
  "urls": ["https://nodejs.org/en/about/previous-releases"],
  "budget": {
    "maxProviderCalls": 1,
    "maxSearchChargeUnits": 1,
    "deadlineMs": 30000,
    "maxOutputTokens": 2048
  }
}
```

For offline capture use `mode: "supplied"`, omit provider/model, and include
`sources: [{ "title": "Brief", "text": "At least 20 characters of source text" }]`.
Optional `urls` use the existing public article importer with DNS pinning,
redirect revalidation, standard ports and bounded text/byte limits. Pasted text
does not trigger network access. Supplied capture retains excerpts without
inventing claims or synthesizing facts. Failed URLs remain explicit gaps.

The web server executes new queued jobs after sending the response. Re-POST the
same request/key after a server restart to resume queued work. Status/evidence
GETs never start paid work. Running jobs interrupted past their deadline fail
without replay. Cancellation propagates to sockets, DNS waits and body readers.
Read-only status polling can expire overdue jobs. This foundation does not yet
add research to the standalone production worker.

Request bodies are limited to 256 KB, at most five pasted sources (40,000
characters each) and five URLs. Provider responses are limited to 1 MB; evidence
publication is bounded to 900 KB so inspection responses fit within 1 MB. Jobs
have a maximum 45-second deadline and 4096 output tokens. URL context's retrieved
input tokens are billed by Gemini; these call/output limits are not a currency
spending cap. Original usage may be uncertain after cancellation or provider
failure. Review it before explicitly refreshing with a new idempotency key.

All responses are JSON with `no-store` and `nosniff`. Never execute source text
or inject returned provider attribution HTML into the app DOM. Consumers must
retain visible source citations and Google's required attribution when displaying
native research, using an appropriately isolated renderer for provider HTML.

## Local writers and shared research

`POST /api/research/evidence/:id/plan` consumes a saved evidence revision with
one explicitly selected Ollama, LM Studio or llama.cpp writer. It returns a scene
plan plus the evidence ID/revision, separate researcher/writer selections,
citations, attribution, usage and a cloud/local disclosure. It does not create a
project or refresh research. To create a project with a saved revision, pass
its `evidenceId` to `POST /api/projects/ai`; this consumes the frozen evidence
without running research again.

Example body for saved OpenAI evidence:

```json
{
  "writer": { "providerId": "ollama", "modelId": "your-installed-model" },
  "research": {
    "mode": "shared",
    "providerId": "openai",
    "modelId": "gpt-4.1-mini"
  },
  "mode": "idea",
  "brief": "Explain the supported product capabilities",
  "budget": { "maxLocalCalls": 1, "deadlineMs": 30000 }
}
```

The shared researcher/model must match the frozen evidence. Use
`research: { "mode": "supplied" }` for supplied-source evidence with no cloud
search. Native evidence cannot be silently relabeled as supplied. New research
requires a configured, explicitly selected cloud backend; consuming saved
research does not require another cloud call or a still-present cloud key.

Only the selected local server is contacted. Missing/offline models fail without
cloud fallback or installation. Exactly one local generation is permitted;
structured-output repair is disabled for this bounded path. Read-only local model
discovery may precede generation. Source context excludes provider HTML and raw
metadata, preserves provenance/gaps and is limited to 24,000 characters; larger
packs fail explicitly rather than silently losing source text. Named automation
tokens need studio write scope and the local writer in their provider allowlist;
no cloud paid-request slot is consumed by local writing.

## Readiness in Settings

**Settings → Research and writer readiness** shows separate researcher and writer
models, native search versus shared local evidence, sources-only mode, missing
credentials and usage bounds. Selecting a writer never changes the selected
researcher. The checker defaults to sources only and requires an explicit Gemini
or OpenAI selection for web research. Its selections check configuration only;
they do not save a creation request or make paid/network provider calls.

Key presence is not a live availability check. Local model discovery is not proof
of search support. The curated research allowlist, writer model, selected mode
and configured keys determine the displayed readiness. Missing keys link the
choice back to provider configuration or sources-only operation. Key/config
changes refresh the capability view. Unsupported research models are rejected
with an actionable error before provider IO, while existing generation models
remain available for writing.
